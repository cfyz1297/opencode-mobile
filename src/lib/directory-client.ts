import { createClient, type Client, type ClientConfig } from "./sdk"

// A connection's stable base object owns its scoped clients. Replacing that
// object (server, credentials or settings changed) starts a fresh cache; the
// old cache is collectible without retaining URLs or credentials as keys.
const clients = new WeakMap<ClientConfig, Map<string | undefined, Client>>()

export function directoryClient(base: ClientConfig, directory?: string): Client {
  let scoped = clients.get(base)
  if (!scoped) {
    scoped = new Map()
    clients.set(base, scoped)
  }
  const existing = scoped.get(directory)
  if (existing) return existing
  const client = createClient({ ...base, directory })
  scoped.set(directory, client)
  return client
}
