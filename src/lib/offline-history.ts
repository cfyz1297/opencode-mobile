// Read-only text snapshots. Never feed this cache back into model prompts or
// tool execution. The native adapter uses Keystore/Keychain-backed storage.
export interface SavedMessage { id: string; role: 'user' | 'assistant'; text: string }
export interface SavedSession { id: string; title: string; directory: string; updated: number; savedAt: number; messages: SavedMessage[] }
interface SourceSession { id: string; title: string; directory: string; time: { updated: number } }
interface SourceMessage { id: string; role: string }
interface SourcePart { type: string; text?: string }
interface Storage { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; remove: (key: string) => Promise<void> }
const MAX_CHARS = 120_000
const CHUNK = 400 // <= 1600 UTF-8 bytes, including non-BMP characters
const MAX_CHUNKS = MAX_CHARS / CHUNK
let serial = 0

export function historySnapshot(session: SourceSession, messages: SourceMessage[], parts: Record<string, SourcePart[]>, now = Date.now()): SavedSession {
  return {
    id: session.id.slice(0, 200), title: session.title.slice(0, 160), directory: session.directory.slice(0, 1000),
    updated: session.time.updated, savedAt: now,
    messages: messages.filter(m => !m.id.startsWith('temp-') && (m.role === 'user' || m.role === 'assistant')).slice(-40).map(m => ({
      id: m.id.slice(0, 200), role: m.role as 'user' | 'assistant',
      text: (parts[m.id] ?? []).filter(p => p.type === 'text').map(p => p.text ?? '').join('\n').slice(0, 6000),
    })),
  }
}

export function createHistory(storage: Storage) {
  // Serializes read-modify-write and clear operations, including concurrent SSE
  // saves. A failed write does not poison the queue.
  let queue: Promise<unknown> = Promise.resolve()
  const run = <T>(action: () => Promise<T>): Promise<T> => {
    const result = queue.then(action)
    queue = result.catch(() => undefined)
    return result
  }
  function key(connection: string) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(connection)) throw new Error('Invalid connection ID')
    return `opencode_history_${connection}`
  }
  async function manifest(base: string): Promise<{ generation: string; count: number } | null> {
    const raw = await storage.get(base)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!/^[a-z0-9_-]{1,80}$/.test(value.generation) || !Number.isInteger(value.count) || value.count < 1 || value.count > MAX_CHUNKS) throw new Error('Invalid history manifest')
    return value
  }
  async function recover(base: string) {
    const pending = await manifest(`${base}_pending`)
    if (!pending) return
    const live = await manifest(base)
    if (pending.generation !== live?.generation) await discard(base, pending)
    await storage.remove(`${base}_pending`)
  }
  async function read(base: string): Promise<SavedSession[]> {
    await recover(base)
    const index = await manifest(base)
    if (!index) return []
    const chunks = await Promise.all(Array.from({ length: index.count }, (_, i) => storage.get(`${base}_${index.generation}_${i}`)))
    if (chunks.some(c => c === null || c.length > CHUNK)) throw new Error('Incomplete offline history')
    const value: unknown = JSON.parse(chunks.join(''))
    if (!Array.isArray(value) || value.length > 20 || value.some(s => !s || typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.directory !== 'string' || !Number.isFinite(s.updated) || !Number.isFinite(s.savedAt) || !Array.isArray(s.messages) || s.messages.length > 40 || s.messages.some((m: SavedMessage) => !m || typeof m.id !== 'string' || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string'))) throw new Error('Invalid offline history')
    return value
  }
  async function discard(base: string, index: { generation: string; count: number } | null) {
    if (index) await Promise.all(Array.from({ length: index.count }, (_, i) => storage.remove(`${base}_${index.generation}_${i}`)))
  }
  async function write(base: string, sessions: SavedSession[]) {
    const old = await manifest(base)
    const saved = sessions.slice(0, 20)
    // Trim oldest messages first, then oldest sessions, to retain readable JSON
    // and bounded native storage even for very large conversations.
    while (JSON.stringify(saved).length > MAX_CHARS) {
      const last = saved[saved.length - 1]
      if (last.messages.length > 1) last.messages.shift()
      else saved.pop()
    }
    const raw = JSON.stringify(saved)
    const generation = `${Date.now().toString(36)}_${(++serial).toString(36)}`
    const count = Math.ceil(raw.length / CHUNK)
    await storage.set(`${base}_pending`, JSON.stringify({ generation, count }))
    try {
      for (let i = 0; i < count; i++) await storage.set(`${base}_${generation}_${i}`, raw.slice(i * CHUNK, (i + 1) * CHUNK))
      await storage.set(base, JSON.stringify({ generation, count }))
    } catch (error) {
      await discard(base, { generation, count }).catch(() => undefined)
      await storage.remove(`${base}_pending`).catch(() => undefined)
      throw error
    }
    await discard(base, old)
    await storage.remove(`${base}_pending`)
  }
  return {
    list: (connection: string) => run(() => read(key(connection))),
    save: (connection: string, session: SavedSession) => run(async () => {
      const base = key(connection)
      await write(base, [session, ...(await read(base)).filter(s => s.id !== session.id)])
    }),
    remove: (connection: string, id: string) => run(async () => {
      const base = key(connection)
      await write(base, (await read(base)).filter(s => s.id !== id))
    }),
    clear: (connection: string) => run(async () => {
      const base = key(connection)
      await recover(base)
      const index = await manifest(base)
      await discard(base, index)
      await storage.remove(base)
    }),
  }
}
