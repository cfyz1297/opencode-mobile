import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import * as Crypto from "expo-crypto"
import type { ServerConnection, ConnectionType } from "../lib/types"
import { createClient, probeServer, type Client, type Project } from "../lib/sdk"
import type { ServerApi } from "../lib/api-detect"
import { buildAuth } from "../lib/auth"
import { stripTrailingSlash } from "../lib/path-utils"
import { offlineHistory } from '../lib/history-storage'
import { directoryClient } from "../lib/directory-client"
import { useSettings } from "./settings"
import { parseStoredJSON } from "../lib/stored-json"

// Where a connection check was initiated from (kept from the former
// analytics.ts — the sources show up in user-facing status/log messages).
export type ConnectionTestSource = "onboarding" | "edit_test" | "sse"

const CONNECTIONS_KEY = "opencode_connections"
const PASSWORDS_PREFIX = "opencode_password_"
// A server password must not ride an iOS backup onto another device; Android's
// Keystore is device-bound already. History uses the same policy.
const SECURE_OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const RECENT_DIRS_KEY = "opencode_recent_dirs"
const MAX_RECENT_DIRS = 10
// A bad IP (unreachable host, wrong port) otherwise hangs for the full 30s
// general request timeout before the user sees a "connection failed" error —
// a first-run bounce driver. The interactive connect flow can afford to fail
// faster since a real server responds to /global/health in well under a
// second; this does NOT affect the timeout used for real session traffic.
const CONNECTION_TEST_TIMEOUT_MS = 12_000

// Cached auth so we can create directory-scoped clients without async SecureStore lookups
interface ClientBase {
  baseUrl: string
  auth?: { username: string; password: string }
  api?: ServerApi
}

interface ConnectionsState {
  connections: ServerConnection[]
  activeConnection: ServerConnection | null
  client: Client | null
  clientBase: ClientBase | null
  currentProject: Project | null
  serverHome: string | null // Home directory on the server machine (for ~ expansion)
  recentDirectories: string[]
  isLoading: boolean
  error: string | null

  // Actions
  loadConnections: () => Promise<void>
  addConnection: (connection: Omit<ServerConnection, "id">, password?: string) => Promise<string>
  removeConnection: (id: string) => Promise<void>
  setActiveConnection: (id: string) => Promise<void>
  // `source` distinguishes the activation funnel (onboarding) from the edit
  // screen's Test button (edit_test) in analytics.
  testConnection: (
    connection: ServerConnection,
    source: ConnectionTestSource,
    password?: string,
  ) => Promise<{ ok: boolean; api?: ServerApi; serverVersion?: string; error?: string }>
  updateConnection: (id: string, updates: Partial<ServerConnection>, password?: string) => Promise<void>
  refreshProject: () => Promise<void>
  // Create a one-off client pointing at a specific directory (for cross-project operations).
  // Pass undefined to get a directory-less client that queries the server without project scope.
  clientForDirectory: (directory?: string) => Client | null
  // Switch the active connection's directory and reload
  switchDirectory: (directory?: string) => Promise<void>
  // Record a directory as recently used
  addRecentDirectory: (directory: string) => Promise<void>
}

function generateId(): string {
  return Crypto.randomUUID().replace(/-/g, "").slice(0, 16)
}

function buildClient(
  url: string,
  directory?: string,
  auth?: { username: string; password: string },
  api?: ServerApi,
): { client: Client; base: ClientBase } {
  const base: ClientBase = { baseUrl: url, auth, api }
  const client = createClient({ baseUrl: url, directory, auth, api })
  return { client, base }
}

// A forced preference in Settings wins over detection (that is the point of the
// switch: reproduce a server bug without waiting for a probe). In "auto" a
// recorded probe is reused; a connection saved before this existed, or while the
// server was down, is probed once and the answer is written back to storage.
// When the probe cannot classify the server we keep the previous behaviour (v2)
// instead of refusing to load a connection the user can still see and edit.
async function resolveApi(
  connection: ServerConnection,
  auth?: { username: string; password: string },
): Promise<{ api?: ServerApi; resolved: boolean }> {
  const preference = useSettings.getState().serverApi
  if (preference !== "auto") return { api: preference, resolved: false }
  if (connection.api) return { api: connection.api, resolved: false }
  try {
    const identity = await probeServer({ baseUrl: connection.url, directory: connection.directory, auth })
    connection.api = identity.api
    connection.serverVersion = identity.version
    // An ambiguous auth rejection says nothing about the generation, so there
    // is nothing worth persisting until a later probe succeeds.
    return { api: identity.api, resolved: identity.api !== undefined }
  } catch {
    return { api: undefined, resolved: false }
  }
}

export const useConnections = create<ConnectionsState>((set, get) => ({
  connections: [],
  activeConnection: null,
  client: null,
  clientBase: null,
  serverHome: null,
  currentProject: null,
  recentDirectories: [],
  isLoading: true,
  error: null,

  loadConnections: async () => {
    try {
      set({ isLoading: true, error: null })
      const [stored, recentRaw] = await Promise.all([
        SecureStore.getItemAsync(CONNECTIONS_KEY),
        SecureStore.getItemAsync(RECENT_DIRS_KEY),
      ])
      const connections: ServerConnection[] = stored ? parseStoredJSON(stored, [], "stored connections") : []
      const recentDirectories: string[] = recentRaw ? parseStoredJSON(recentRaw, [], "recent directories") : []

      // Find active connection
      const active = connections.find((c) => c.active) || null

      // Create client for active connection
      let client: Client | null = null
      let base: ClientBase | null = null
      if (active) {
        const password = await SecureStore.getItemAsync(`${PASSWORDS_PREFIX}${active.id}`)
        const auth = buildAuth(active.username, password)
        const { api, resolved } = await resolveApi(active, auth)
        const built = buildClient(active.url, active.directory, auth, api)
        client = built.client
        base = built.base
        // Persist a probe that was only just discovered, so the next launch
        // picks the same transport without probing again.
        if (resolved) await SecureStore.setItemAsync(CONNECTIONS_KEY, JSON.stringify(connections))
      }

      set({
        connections,
        activeConnection: active,
        client,
        clientBase: base,
        currentProject: null,
        serverHome: null,
        recentDirectories,
        isLoading: false,
      })
      // Local navigation, including saved history, must work before a network
      // request completes. Ignore metadata if the user has switched clients.
      if (client) {
        const hydratedClient = client
        void Promise.all([
          client.project.current().catch(() => null),
          client.path.get().catch(() => null),
        ]).then(([project, paths]) => {
          if (get().client !== hydratedClient) return
          set({ currentProject: project, serverHome: paths?.home || null })
        })
      }
    } catch (error) {
      set({ error: "Failed to load connections", isLoading: false })
    }
  },

  addConnection: async (connection, password) => {
    const id = generateId()
    const newConnection: ServerConnection = {
      ...connection,
      id,
      active: get().connections.length === 0, // First connection is active
    }

    const connections = [...get().connections, newConnection]

    // Store password separately if provided
    if (password) {
      await SecureStore.setItemAsync(`${PASSWORDS_PREFIX}${id}`, password, SECURE_OPTIONS)
    }

    await SecureStore.setItemAsync(CONNECTIONS_KEY, JSON.stringify(connections))

    // If this is the first/active connection, create client
    let client = get().client
    let base = get().clientBase
    let activeConnection = get().activeConnection

    let project = get().currentProject
    let serverHome = get().serverHome

    if (newConnection.active) {
      activeConnection = newConnection
      const auth = buildAuth(newConnection.username, password)
      const { api, resolved } = await resolveApi(newConnection, auth)
      const built = buildClient(newConnection.url, newConnection.directory, auth, api)
      client = built.client
      base = built.base
      if (resolved) await SecureStore.setItemAsync(CONNECTIONS_KEY, JSON.stringify(connections))

      // Fetch server metadata so loadSessions can use clientForDirectory(serverHome)
      // immediately after the connection is added (same as setActiveConnection does).
      try {
        const [proj, paths] = await Promise.all([
          client.project.current().catch(() => null),
          client.path.get().catch(() => null),
        ])
        project = proj
        serverHome = paths?.home || null
      } catch {
        // Server might be unreachable; proceed without metadata
      }
    }

    set({ connections, activeConnection, client, clientBase: base, currentProject: project, serverHome })
    return id
  },

  removeConnection: async (id) => {
    offlineHistory.block(id)
    try {
    await offlineHistory.clear(id)
    const connections = get().connections.filter((c) => c.id !== id)

    // Remove stored password
    await SecureStore.deleteItemAsync(`${PASSWORDS_PREFIX}${id}`)
    await SecureStore.setItemAsync(CONNECTIONS_KEY, JSON.stringify(connections))

    // If removing active connection, clear client
    const wasActive = get().activeConnection?.id === id
    if (wasActive) {
      const newActive = connections[0] || null
      if (newActive) {
        // Mark new connection as active
        newActive.active = true
        await SecureStore.setItemAsync(CONNECTIONS_KEY, JSON.stringify(connections))
        const password = await SecureStore.getItemAsync(`${PASSWORDS_PREFIX}${newActive.id}`)
        const auth = buildAuth(newActive.username, password)
        const { api, resolved } = await resolveApi(newActive, auth)
        const built = buildClient(newActive.url, newActive.directory, auth, api)
        if (resolved) await SecureStore.setItemAsync(CONNECTIONS_KEY, JSON.stringify(connections))
        set({ connections, activeConnection: newActive, client: built.client, clientBase: built.base })
      } else {
        set({ connections, activeConnection: null, client: null, clientBase: null })
      }
    } else {
      set({ connections })
    }
    } catch (error) {
      offlineHistory.unblock(id)
      throw error
    }
  },

  setActiveConnection: async (id) => {
    const connections = get().connections.map((c) => ({
      ...c,
      active: c.id === id,
    }))

    const active = connections.find((c) => c.id === id) || null
    let client: Client | null = null
    let base: ClientBase | null = null
    let project: Project | null = null
    let home: string | null = null

    if (active) {
      const password = await SecureStore.getItemAsync(`${PASSWORDS_PREFIX}${active.id}`)
      const auth = buildAuth(active.username, password)
      const { api } = await resolveApi(active, auth)
      const built = buildClient(active.url, active.directory, auth, api)
      client = built.client
      base = built.base

      try {
        const [proj, paths] = await Promise.all([
          client.project.current().catch(() => null),
          client.path.get().catch(() => null),
        ])
        project = proj
        home = paths?.home || null
      } catch {
        // Server might be offline
      }

      // Update last connected time
      active.lastConnected = Date.now()
      await SecureStore.setItemAsync(CONNECTIONS_KEY, JSON.stringify(connections))
    }

    set({ connections, activeConnection: active, client, clientBase: base, currentProject: project, serverHome: home })
  },

  testConnection: async (connection, source, password) => {
    try {
      // BUG-007: on the edit screen the password field is blank ("keep existing"),
      // so fall back to the saved password instead of testing with no auth at all.
      let resolvedPassword = password
      if (!resolvedPassword && source === "edit_test") {
        resolvedPassword = (await SecureStore.getItemAsync(`${PASSWORDS_PREFIX}${connection.id}`)) ?? undefined
      }
      const auth = buildAuth(connection.username, resolvedPassword)
      const preference = useSettings.getState().serverApi
      // Probe before anything else. Against a v1 server the v2 health route is
      // not a route at all — it falls through to the web SPA and answers 200
      // with HTML, which used to read as "connected" and then failed on every
      // real request.
      const identity =
        preference === "auto"
          ? await probeServer({ baseUrl: connection.url, directory: connection.directory, auth })
          : { api: preference, version: undefined }
      const client = createClient({
        baseUrl: connection.url,
        directory: connection.directory,
        auth,
        api: identity.api,
      })

      const health = await client.global.health(CONNECTION_TEST_TIMEOUT_MS)
      if (!health.healthy) return { ok: false, error: 'Server is not healthy' }
      return { ok: true, api: identity.api, serverVersion: identity.version }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, error: message }
    }
  },

  updateConnection: async (id, updates, password) => {
    const connections = get().connections.map((c) => {
      if (c.id !== id) return c
      const merged = { ...c, ...updates }
      // The edit screen always sends the URL back. Without a fresh probe it
      // means "keep what is there" — but the same address may have been
      // swapped between V1 and V2 since the last probe, so drop the recorded
      // answer and re-detect. A probe from "Test connection" wins.
      if (updates.url !== undefined && updates.api === undefined) {
        merged.api = undefined
        merged.serverVersion = undefined
      }
      return merged
    })

    await SecureStore.setItemAsync(CONNECTIONS_KEY, JSON.stringify(connections))

    // Persist a new password only when one was entered. The edit form loads the
    // password field blank (passwords aren't read back for security), so an
    // empty value means "keep the existing password", not "clear it". Written
    // before the active-client rebuild below so the rebuilt client picks it up.
    if (password) {
      await SecureStore.setItemAsync(`${PASSWORDS_PREFIX}${id}`, password, SECURE_OPTIONS)
    }

    // If updating active connection, recreate client
    if (get().activeConnection?.id === id) {
      const active = connections.find((c) => c.id === id)!
      const password = await SecureStore.getItemAsync(`${PASSWORDS_PREFIX}${id}`)
      const auth = buildAuth(active.username, password)
      const { api, resolved } = await resolveApi(active, auth)
      const built = buildClient(active.url, active.directory, auth, api)
      // A URL change re-probes here, so store the fresh answer too.
      if (resolved) await SecureStore.setItemAsync(CONNECTIONS_KEY, JSON.stringify(connections))
      try {
        const [project, paths] = await Promise.all([
          built.client.project.current().catch(() => null),
          built.client.path.get().catch(() => null),
        ])
        set({
          connections,
          activeConnection: active,
          client: built.client,
          clientBase: built.base,
          currentProject: project,
          serverHome: paths?.home || null,
        })
      } catch {
        set({
          connections,
          activeConnection: active,
          client: built.client,
          clientBase: built.base,
          currentProject: null,
        })
      }
    } else {
      set({ connections })
    }
  },

  refreshProject: async () => {
    const client = get().client
    if (!client) return

    try {
      const project = await client.project.current()
      set({ currentProject: project })
    } catch {
      set({ currentProject: null })
    }
  },

  clientForDirectory: (directory) => {
    const base = get().clientBase
    if (!base) return null
    // Reuse current client if directory matches
    const active = get().activeConnection
    if (active?.directory === directory) return get().client
    return directoryClient(base, directory)
  },

  switchDirectory: async (directory) => {
    const active = get().activeConnection
    if (!active) return
    // Update connection directory and recreate client. Normalize trailing
    // slashes so "/home/user" and "/home/user/" don't diverge (recent-dir
    // duplicates + a mismatched "current directory" highlight).
    const trimmed = directory?.trim()
    const dir = trimmed ? stripTrailingSlash(trimmed) : undefined
    await get().updateConnection(active.id, { directory: dir })
    // Record in recents if it's a real directory
    if (dir) await get().addRecentDirectory(dir)
  },

  addRecentDirectory: async (directory) => {
    const current = get().recentDirectories
    // Normalize trailing slashes so the same dir entered as ".../x" and
    // ".../x/" dedups to one recent-list entry instead of two.
    directory = stripTrailingSlash(directory.trim())
    // Move to front, dedup, cap at MAX
    const updated = [directory, ...current.filter((d) => d !== directory)].slice(0, MAX_RECENT_DIRS)
    set({ recentDirectories: updated })
    await SecureStore.setItemAsync(RECENT_DIRS_KEY, JSON.stringify(updated))
  },
}))
