/** Only connection IDs and provider/model IDs are persisted. Never server credentials. */
export type HiddenModels = Array<[string, string[]]>
const STORAGE_KEY = 'opencode_model_visibility_v1'
const MAX_IDS = 10000

export function modelKey(providerID: string, modelID: string): string {
  return JSON.stringify([providerID, modelID])
}

function validKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false
  try {
    const pair: unknown = JSON.parse(value)
    return Array.isArray(pair) && pair.length === 2 && pair.every(id => typeof id === 'string' && id.length > 0)
  } catch { return false }
}

export function parseHiddenModels(raw: string | null): HiddenModels {
  if (!raw || raw.length > 4_000_000) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    const result = new Map<string, string[]>()
    for (const entry of value.slice(0, 100)) {
      if (!Array.isArray(entry) || entry.length !== 2) continue
      const [scope, ids] = entry
      if (typeof scope !== 'string' || !scope || scope.length > 256 || !Array.isArray(ids)) continue
      result.set(scope, [...new Set(ids.slice(0, MAX_IDS).filter(validKey))])
    }
    return [...result]
  } catch { return [] }
}

export function createModelVisibility(storage: {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
}, changed: (value: HiddenModels) => void = () => {}) {
  let state = new Map<string, string[]>()
  let loading: Promise<void> | undefined
  let queue: Promise<void> = Promise.resolve()
  const load = () => {
    if (!loading) {
      loading = storage.getItem(STORAGE_KEY).then(raw => {
        state = new Map(parseHiddenModels(raw))
        changed([...state])
      }).catch(error => { loading = undefined; throw error })
    }
    return loading
  }
  return {
    load,
    hidden: (scope: string) => [...(state.get(scope) ?? [])],
    setEnabled: (scope: string, provider: string, model: string, enabled: boolean) => {
      const operation = queue.then(async () => {
        await load()
        const key = modelKey(provider, model)
        if (!scope || scope.length > 256 || !validKey(key)) throw new Error('Invalid model preference')
        const ids = new Set(state.get(scope) ?? [])
        if (enabled) ids.delete(key)
        else ids.add(key)
        if (ids.size > MAX_IDS) throw new Error('Too many model preferences')
        const next = new Map(state)
        if (ids.size) next.set(scope, [...ids])
        else next.delete(scope)
        if (next.size > 100) throw new Error('Too many connections')
        const serialized = JSON.stringify([...next])
        if (serialized.length > 4_000_000) throw new Error('Model preferences too large')
        await storage.setItem(STORAGE_KEY, serialized)
        state = next
        changed([...state])
      })
      queue = operation.catch(() => {})
      return operation
    },
  }
}
