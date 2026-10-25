import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createModelVisibility, modelKey, parseHiddenModels } from './model-visibility.ts'
import { buildModelPickerSections } from './model-picker-filter.ts'

const providers = [{ id: 'go', name: 'OpenCode Go', models: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }] }, { id: 'other', name: 'Other', models: [{ id: 'a', name: 'Alpha' }] }]

test('hide, persist, reload, re-enable and isolate servers and providers', async () => {
  let saved: string | null = null
  const storage = { getItem: async () => saved, setItem: async (_: string, value: string) => { saved = value } }
  const preferences = createModelVisibility(storage)
  await preferences.setEnabled('server1', 'go', 'a', false)
  const restored = createModelVisibility(storage)
  await restored.load()
  assert.deepEqual(restored.hidden('server1'), [modelKey('go', 'a')])
  assert.deepEqual(restored.hidden('server2'), [])
  const sections = buildModelPickerSections({ providers, query: '', selected: null, hidden: restored.hidden('server1') })
  assert.deepEqual(sections.map(s => s.data.map(m => m.modelID)), [['b'], ['a']])
  await restored.setEnabled('server1', 'go', 'a', true)
  assert.deepEqual(restored.hidden('server1'), [])
})

test('rapid toggles are saved in order and load cannot overwrite edits', async () => {
  let saved: string | null = null
  const preferences = createModelVisibility({ getItem: async () => saved, setItem: async (_, value) => { await new Promise(r => setTimeout(r, 2)); saved = value } })
  await Promise.all([preferences.setEnabled('s', 'go', 'a', false), preferences.setEnabled('s', 'go', 'b', false), preferences.setEnabled('s', 'go', 'a', true)])
  assert.deepEqual(preferences.hidden('s'), [modelKey('go', 'b')])
  assert.deepEqual(parseHiddenModels(saved), [['s', [modelKey('go', 'b')]]])
})

test('failed writes preserve last committed state and subsequent writes recover', async () => {
  let fail = true
  const preferences = createModelVisibility({ getItem: async () => null, setItem: async () => { if (fail) throw new Error('disk') } })
  await assert.rejects(preferences.setEnabled('s', 'go', 'a', false))
  assert.deepEqual(preferences.hidden('s'), [])
  fail = false
  await preferences.setEnabled('s', 'go', 'a', false)
  assert.equal(preferences.hidden('s').length, 1)
})

test('storage validation handles corrupted and hostile entries without object keys', () => {
  for (const value of [null, '{', '{}', 'null', '42']) assert.deepEqual(parseHiddenModels(value), [])
  assert.deepEqual(parseHiddenModels(JSON.stringify([['__proto__', [modelKey('__proto__', 'a')]], ['s', [1, {}, modelKey('go', 'a')]]])), [['__proto__', [modelKey('__proto__', 'a')]], ['s', [modelKey('go', 'a')]]])
  assert.notEqual(modelKey('a/b', 'c'), modelKey('a', 'b/c'))
})

test('search keeps hidden settings discoverable; picker never reveals them even when selected', () => {
  const hidden = [modelKey('go', 'a'), modelKey('go', 'b')]
  assert.equal(buildModelPickerSections({ providers, query: 'Go', selected: null }).length, 1)
  assert.deepEqual(buildModelPickerSections({ providers, query: 'Go', selected: { providerID: 'go', modelID: 'a' }, hidden }), [])
  assert.equal(buildModelPickerSections({ providers, query: 'ALPHA', selected: null, hidden }).length, 1)
  assert.equal(buildModelPickerSections({ providers, query: '', selected: null, hidden: [] })[0].data.length, 2)
})

test('read failures are retryable and returned arrays cannot mutate preferences', async () => {
  let failed = true
  const preferences = createModelVisibility({ getItem: async () => { if (failed) throw new Error('disk'); return null }, setItem: async () => {} })
  await assert.rejects(preferences.load())
  failed = false
  await preferences.load()
  await preferences.setEnabled('s', 'go', 'a', false)
  preferences.hidden('s').length = 0
  assert.equal(preferences.hidden('s').length, 1)
  await assert.rejects(preferences.setEnabled('', 'go', 'a', false))
})
