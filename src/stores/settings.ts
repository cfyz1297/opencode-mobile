import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import { type Category, defaultPreferences } from "../lib/notifications"
import { mergeStoredSettings } from "../lib/settings-merge"
import { clampTurns } from "../lib/message-page"
import { setAppLocale } from "../lib/i18n/config"
import type { LocalePreference } from "../lib/i18n/locale-resolve"
import type { ServerApi } from "../lib/api-detect"

const SETTINGS_KEY = "opencode_settings"

/** "auto" probes each connection once and remembers the answer. The explicit
 *  values force a transport, e.g. to reproduce a server-side bug. */
export type ServerApiPreference = "auto" | ServerApi

// Parse JSON from SecureStore, tolerating corrupted data (BUG-016).
function parseStoredJSON<T>(raw: string, fallback: T | null): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    console.warn("Failed to parse stored settings JSON, using fallback")
    return fallback
  }
}

interface Settings {
  settingsVersion: number
  // Exchanges (user prompts) a session opens with — see lib/message-page.ts.
  pageSize: number
  notifications: Record<Category, boolean>
  locale: LocalePreference
  // Which server transport connections default to (see ServerApiPreference).
  serverApi: ServerApiPreference
}

const DEFAULTS: Settings = {
  settingsVersion: 2,
  pageSize: 10,
  notifications: { ...defaultPreferences },
  locale: "system",
  serverApi: "auto",
}

interface SettingsState extends Settings {
  loaded: boolean
  load: () => Promise<void>
  setPageSize: (size: number) => Promise<void>
  setNotification: (category: Category, enabled: boolean) => Promise<void>
  setLocale: (locale: LocalePreference) => Promise<void>
  setServerApi: (preference: ServerApiPreference) => Promise<void>
}

function snapshot(get: () => SettingsState): Settings {
  return {
    settingsVersion: DEFAULTS.settingsVersion,
    pageSize: get().pageSize,
    notifications: get().notifications,
    locale: get().locale,
    serverApi: get().serverApi,
  }
}

async function persist(settings: Settings) {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings))
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY)
    if (raw) {
      const parsed = parseStoredJSON<Partial<Settings>>(raw, null)
      // Merge stored settings with defaults so new fields/categories get their default
      const merged = parsed ? mergeStoredSettings(DEFAULTS, parsed) : DEFAULTS
      // v1 stored pageSize in raw messages; v2 counts exchanges. An old 25 meant
      // about one prompt, so the numbers are not comparable — start from the
      // default rather than opening long sessions in full.
      if ((parsed?.settingsVersion ?? 1) < 2) merged.pageSize = DEFAULTS.pageSize
      if (merged.serverApi !== "auto" && merged.serverApi !== "v1" && merged.serverApi !== "v2") {
        merged.serverApi = DEFAULTS.serverApi
      }
      set({ ...merged, loaded: true })
      setAppLocale(merged.locale)
      return
    }
    set({ loaded: true })
  },

  setPageSize: async (size) => {
    const clamped = clampTurns(size)
    set({ pageSize: clamped })
    await persist({ ...snapshot(get), pageSize: clamped })
  },

  setNotification: async (category, enabled) => {
    const notifications = { ...get().notifications, [category]: enabled }
    set({ notifications })
    await persist({ ...snapshot(get), notifications })
  },

  setLocale: async (locale) => {
    set({ locale })
    setAppLocale(locale) // applies immediately
    await persist({ ...snapshot(get), locale })
  },

  setServerApi: async (preference) => {
    set({ serverApi: preference })
    await persist({ ...snapshot(get), serverApi: preference })
  },
}))
