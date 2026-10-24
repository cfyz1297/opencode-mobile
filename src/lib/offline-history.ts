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
const MAX_CHUNKS = 320
const CONSENT_KEY = 'opencode_history_enabled'
type Manifest = { generation: 'a' | 'b'; count: number }
function bounded(text: string, max: number): string {
  const value = text.slice(0, max)
  return /[\uD800-\uDBFF]$/.test(value) ? value.slice(0, -1) : value
}

export function historySnapshot(session: SourceSession, messages: SourceMessage[], parts: Record<string, SourcePart[]>, now = Date.now()): SavedSession {
  return {
    id: bounded(session.id, 200), title: bounded(session.title, 160), directory: bounded(session.directory, 1000),
    updated: session.time.updated, savedAt: now,
    messages: messages.filter(m => !m.id.startsWith('temp-') && (m.role === 'user' || m.role === 'assistant')).slice(-40).map(m => ({
      id: bounded(m.id, 200), role: m.role as 'user' | 'assistant',
      text: bounded((parts[m.id] ?? []).filter(p => p.type === 'text').map(p => p.text ?? '').join('\n'), 6000),
    })),
  }
}

export function createHistory(storage: Storage) {
  // Serializes read-modify-write and clear operations, including concurrent SSE
  // saves. A failed write does not poison the queue.
  let queue: Promise<unknown> = Promise.resolve()
  let captureEpoch = 0
  const blocked = new Set<string>()
  const run = <T>(action: () => Promise<T>): Promise<T> => {
    const result = queue.then(action)
    queue = result.catch(() => undefined)
    return result
  }
  function key(connection: string) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(connection)) throw new Error('Invalid connection ID')
    return `opencode_history_${connection}`
  }
  async function manifest(base: string): Promise<Manifest | null> {
    const raw = await storage.get(base)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!['a', 'b'].includes(value.generation) || !Number.isInteger(value.count) || value.count < 1 || value.count > MAX_CHUNKS) throw new Error('Invalid history manifest')
    return value
  }
  async function recover(base: string) {
    const pending = await manifest(`${base}_pending`)
    if (!pending) return
    const live = await manifest(base)
    // Two fixed slots make every possible chunk discoverable, including after
    // a crash during post-commit cleanup or corruption of the manifest itself.
    const unused = pending.generation === live?.generation ? (pending.generation === 'a' ? 'b' : 'a') : pending.generation
    await discard(base, { generation: unused, count: MAX_CHUNKS })
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
  async function discard(base: string, index: Manifest | null) {
    // Bound native work rather than launching hundreds of Keystore operations
    // in a single bridge turn.
    if (!index) return
    for (let start = 0; start < index.count; start += 16) {
      await Promise.all(Array.from({ length: Math.min(16, index.count - start) }, (_, i) => storage.remove(`${base}_${index.generation}_${start + i}`)))
    }
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
    const generation = old?.generation === 'a' ? 'b' : 'a'
    // Native SecureStore encodes each value independently as UTF-8. Splitting
    // a surrogate pair would irreversibly replace emoji with U+FFFD.
    const chunks: string[] = []
    let chunk = ''
    for (const character of raw) {
      if (chunk.length + character.length > CHUNK) { chunks.push(chunk); chunk = '' }
      chunk += character
    }
    if (chunk) chunks.push(chunk)
    const count = chunks.length
    await storage.set(`${base}_pending`, JSON.stringify({ generation, count }))
    try {
      for (let i = 0; i < count; i++) await storage.set(`${base}_${generation}_${i}`, chunks[i])
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
    enabled: () => run(async () => (await storage.get(CONSENT_KEY)) === 'true'),
    setEnabled: (enabled: boolean) => {
      captureEpoch++ // Synchronous cancellation of flag reads already in flight.
      return run(() => storage.set(CONSENT_KEY, String(enabled)))
    },
    block: (connection: string) => { key(connection); blocked.add(connection) },
    unblock: (connection: string) => { blocked.delete(connection) },
    capture: (connection: string, session: SavedSession) => {
      const epoch = captureEpoch
      return run(async () => {
        const base = key(connection)
        const enabled = await storage.get(CONSENT_KEY)
        if (epoch !== captureEpoch || enabled !== 'true' || blocked.has(connection)) return
        await write(base, [session, ...(await read(base)).filter(s => s.id !== session.id)])
      })
    },
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
      await discard(base, { generation: 'a', count: MAX_CHUNKS })
      await discard(base, { generation: 'b', count: MAX_CHUNKS })
      await storage.remove(`${base}_pending`)
      await storage.remove(base)
    }),
  }
}
