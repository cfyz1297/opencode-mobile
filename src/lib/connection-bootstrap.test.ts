import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createStore } from 'zustand/vanilla'

function harness() {
  let release!: (value: unknown) => void
  const metadata = new Promise(resolve => { release = resolve })
  const client = { project: { current: () => metadata }, path: { get: () => metadata } }
  const values = new Map([['opencode_connections', JSON.stringify([{ id: 'a', name: 'A', url: 'https://a.example', type: 'tunnel', active: true }])]])
  const source = fs.readFileSync(new URL('../stores/connections.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, any> = {}
  const deps: Record<string, unknown> = {
    zustand: { create: createStore },
    'expo-secure-store': { getItemAsync: async (key: string) => values.get(key) ?? null },
    'expo-crypto': { randomUUID: () => 'a' },
    '../lib/sdk': { createClient: () => client },
    '../lib/auth': { buildAuth: () => undefined },
    '../lib/path-utils': { stripTrailingSlash: (s: string) => s },
    '../lib/history-storage': { offlineHistory: { clear: async () => undefined } },
  }
  vm.runInNewContext(code, { exports, require: (name: string) => { assert.ok(name in deps, name); return deps[name] }, console })
  return { store: exports.useConnections, release, client }
}
test('offline cold start unlocks app without waiting for server metadata', async () => {
  const { store, release } = harness()
  const loading = store.getState().loadConnections()
  const immediate = await Promise.race([loading.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 40))])
  const isLoading = store.getState().isLoading
  release(null)
  await loading
  assert.equal(immediate, true, 'offline history must not wait for network timeout')
  assert.equal(isLoading, false)
  assert.equal(store.getState().activeConnection.id, 'a')
})
test('late metadata response never replaces another connection metadata', async () => {
  const { store, release } = harness()
  const loading = store.getState().loadConnections()
  await new Promise(resolve => setTimeout(resolve, 10))
  store.setState({ client: { different: true }, currentProject: { id: 'other' } })
  release({ id: 'old', home: '/old' })
  await loading
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(store.getState().currentProject.id, 'other')
})
