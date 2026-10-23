import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHistory, historySnapshot } from './offline-history.ts'

const snapshot = (id = 's1') => historySnapshot({ id, title: 'Saved session', directory: '/project', time: { updated: 1 } }, [
  { id: 'm1', role: 'user' }, { id: 'm2', role: 'assistant' }, { id: 'temp-1', role: 'user' },
], { m1: [{ type: 'text', text: 'Question' }, { type: 'file', url: 'data:secret' }], m2: [{ type: 'text', text: 'Answer' }, { type: 'tool', state: { output: 'secret' } }] }, 100)
function storage() {
  const data = new Map<string, string>()
  return { data, get: async (k: string) => data.get(k) ?? null, set: async (k: string, v: string) => { data.set(k, v) }, remove: async (k: string) => { data.delete(k) } }
}
test('offline snapshot is text only, excludes transient messages, credentials and tool payloads', () => {
  const saved = snapshot()
  assert.equal(saved.messages.length, 2)
  assert.equal(saved.messages[1].text, 'Answer')
  assert.ok(!JSON.stringify(saved).includes('secret'))
})
test('cold launch recovers encrypted-store chunks, connection scopes remain isolated', async () => {
  const s = storage()
  await createHistory(s).save('connection-a', snapshot())
  assert.equal((await createHistory(s).list('connection-a'))[0].id, 's1')
  assert.deepEqual(await createHistory(s).list('connection-b'), [])
  assert.ok([...s.data.values()].every(v => Buffer.byteLength(v) <= 1800))
})
test('interrupted write preserves previous complete generation', async () => {
  const s = storage()
  const history = createHistory(s)
  await history.save('a', snapshot('old'))
  let writes = 0
  const broken = createHistory({ ...s, set: async (k, v) => { if (++writes === 2) throw new Error('disk full'); await s.set(k, v) } })
  await assert.rejects(broken.save('a', snapshot('new')))
  assert.equal((await createHistory(s).list('a'))[0].id, 'old')
})
test('cache has bounds, handles Unicode, deletes sessions and clears all connection data', async () => {
  const s = storage(), h = createHistory(s)
  for (let i = 0; i < 23; i++) await h.save('a', { ...snapshot(`s${i}`), title: 'Привет 😀'.repeat(60) })
  assert.equal((await h.list('a')).length, 20)
  await h.remove('a', 's22')
  assert.ok(!(await h.list('a')).some(x => x.id === 's22'))
  await h.clear('a')
  assert.equal(s.data.size, 0)
})
test('corruption is reported without returning partial transcripts', async () => {
  const s = storage(), h = createHistory(s)
  await h.save('a', snapshot())
  const key = [...s.data.keys()].find(k => k.endsWith('_0'))!
  s.data.delete(key)
  await assert.rejects(h.list('a'))
})
test('unsafe connection keys cannot escape storage namespace', async () => {
  await assert.rejects(createHistory(storage()).list('../a'))
})
test('concurrent saves are serialized and neither session is lost', async () => {
  const s = storage(), h = createHistory(s)
  await Promise.all([h.save('a', snapshot('one')), h.save('a', snapshot('two'))])
  assert.deepEqual((await h.list('a')).map(x => x.id), ['two', 'one'])
})
test('process-death staging data is cleaned on cold launch and clear', async () => {
  const s = storage(), h = createHistory(s)
  await h.save('a', snapshot())
  s.data.set('opencode_history_a_pending', JSON.stringify({ generation: 'crashed', count: 1 }))
  s.data.set('opencode_history_a_crashed_0', 'private partial write')
  assert.equal((await createHistory(s).list('a')).length, 1)
  assert.ok(!s.data.has('opencode_history_a_crashed_0'))
  await h.clear('a')
  assert.equal(s.data.size, 0)
})
test('large transcripts are bounded without breaking JSON or UTF-8', async () => {
  const s = storage(), h = createHistory(s)
  const big = { ...snapshot(), messages: Array.from({ length: 40 }, (_, i) => ({ id: String(i), role: 'user' as const, text: '😀'.repeat(3000) })) }
  await h.save('a', big)
  const saved = await h.list('a')
  assert.ok(saved[0].messages.length < 40)
  assert.ok([...s.data.values()].every(v => Buffer.byteLength(v) <= 1800))
})
test('malicious stored manifests and payloads fail closed', async () => {
  const s = storage(), h = createHistory(s)
  s.data.set('opencode_history_a', '{"generation":"../secret","count":99999999}')
  await assert.rejects(h.list('a'))
  s.data.clear()
  s.data.set('opencode_history_a', '{"generation":"x","count":1}')
  s.data.set('opencode_history_a_x_0', '[{"id":"x","messages":[]}]')
  await assert.rejects(h.list('a'))
})
test('native UTF-8 storage preserves emoji exactly at every chunk boundary', async () => {
  const s = storage()
  const native = { ...s, set: async (key: string, value: string) => s.set(key, Buffer.from(value, 'utf8').toString('utf8')) }
  const h = createHistory(native)
  const text = 'x' + '😀'.repeat(1000)
  await h.save('a', { ...snapshot(), messages: [{ id: 'm', role: 'user', text }] })
  assert.equal((await h.list('a'))[0].messages[0].text, text)
})
test('clear removes every private chunk after postcommit cleanup failure', async () => {
  const s = storage()
  await createHistory(s).save('a', snapshot('old-private'))
  const oldKeys = new Set(s.data.keys())
  const broken = createHistory({ ...s, remove: async key => { if (oldKeys.has(key) && key.endsWith('_0')) throw new Error('simulated process death after commit'); await s.remove(key) } })
  await assert.rejects(broken.save('a', snapshot('new')))
  await createHistory(s).list('a')
  await createHistory(s).clear('a')
  assert.equal(s.data.size, 0, 'no orphaned old transcripts may survive clear')
})
test('corrupt manifest never prevents erasing cached data', async () => {
  const s = storage(), h = createHistory(s)
  await h.save('a', snapshot())
  s.data.set('opencode_history_a', 'broken JSON')
  await h.clear('a')
  assert.equal(s.data.size, 0)
})
test('disable and removal invalidate pending captures inside the storage queue', async () => {
  const s = storage(), h = createHistory(s)
  await h.setEnabled(true)
  const first = h.capture('a', snapshot('one'))
  const disabled = h.setEnabled(false)
  await Promise.all([first, disabled])
  await h.clear('a')
  await h.capture('a', snapshot('late'))
  assert.deepEqual(await h.list('a'), [])
  await h.setEnabled(true)
  h.block('a')
  await h.capture('a', snapshot('removed'))
  assert.deepEqual(await h.list('a'), [])
})
