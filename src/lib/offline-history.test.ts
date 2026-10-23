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
