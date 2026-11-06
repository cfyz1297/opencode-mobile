import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from "node:url"
import vm from 'node:vm'
import ts from 'typescript'
import { createStore } from 'zustand/vanilla'

function harness(options: { serverApi?: string } = {}) {
  let release!: (value: unknown) => void
  const metadata = new Promise(resolve => { release = resolve })
  const probes: string[] = []
  const writes: string[] = []
  const client = { project: { current: () => metadata }, path: { get: () => metadata } }
  const values = new Map([['opencode_connections', JSON.stringify([{ id: 'a', name: 'A', url: 'https://a.example', type: 'tunnel', active: true }])]])
  const source = fs.readFileSync(fileURLToPath(new URL('../stores/connections.ts', import.meta.url).href), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, any> = {}
  const deps: Record<string, unknown> = {
    zustand: { create: createStore },
    'expo-secure-store': {
      getItemAsync: async (key: string) => values.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { values.set(key, value); writes.push(key) },
    },
    'expo-crypto': { randomUUID: () => 'a' },
    '../lib/sdk': {
      createClient: () => client,
      probeServer: async (config: { baseUrl: string }) => {
        probes.push(config.baseUrl)
        return { api: 'v2', version: '2.0.test' }
      },
    },
    './settings': { useSettings: { getState: () => ({ serverApi: options.serverApi ?? 'auto' }) } },
    '../lib/directory-client': { directoryClient: () => client },
    '../lib/auth': { buildAuth: () => undefined },
    '../lib/path-utils': { stripTrailingSlash: (s: string) => s },
    '../lib/history-storage': { offlineHistory: { block: () => undefined, clear: async () => undefined } },
    '../lib/stored-json': {
      parseStoredJSON: (raw: string, fallback: unknown) => {
        try {
          return JSON.parse(raw)
        } catch {
          return fallback
        }
      },
    },
  }
  vm.runInNewContext(code, { exports, require: (name: string) => { assert.ok(name in deps, name); return deps[name] }, console })
  return { store: exports.useConnections, release, client, values, probes, writes }
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

test('an unprobed connection is detected once and the answer is persisted', async () => {
  const { store, release, values, probes } = harness()
  const loading = store.getState().loadConnections()
  release(null)
  await loading
  assert.deepEqual(probes, ['https://a.example'])
  const stored = JSON.parse(values.get('opencode_connections')!)
  assert.equal(stored[0].api, 'v2')
  assert.equal(stored[0].serverVersion, '2.0.test')
})

test('a forced server API skips the probe', async () => {
  const { store, release, probes } = harness({ serverApi: 'v1' })
  const loading = store.getState().loadConnections()
  release(null)
  await loading
  assert.deepEqual(probes, [])
})

test('changing the URL drops the recorded API, changing the title keeps it', async () => {
  const { store, values, release } = harness()
  release(null)
  store.setState({
    connections: [{ id: 'a', name: 'A', url: 'https://a.example', type: 'tunnel', active: true, api: 'v2', serverVersion: '2.0.test' }],
    activeConnection: { id: 'a', name: 'A', url: 'https://a.example', type: 'tunnel', active: true, api: 'v2', serverVersion: '2.0.test' },
  })
  await store.getState().updateConnection('a', { name: 'renamed' })
  assert.equal(store.getState().connections[0].api, 'v2')

  // A new URL is a new server: the recorded answer is dropped and re-detected.
  await store.getState().updateConnection('a', { url: 'https://b.example' })
  assert.equal(store.getState().connections[0].api, 'v2')
  assert.equal(JSON.parse(values.get('opencode_connections')!)[0].url, 'https://b.example')
})

test('a fresh probe from the edit screen wins over the URL-change reset', async () => {
  const { store, release } = harness()
  release(null)
  store.setState({
    connections: [{ id: 'a', name: 'A', url: 'https://a.example', type: 'tunnel', active: true, api: 'v2', serverVersion: '2.0.test' }],
    activeConnection: { id: 'a', name: 'A', url: 'https://a.example', type: 'tunnel', active: true, api: 'v2', serverVersion: '2.0.test' },
  })
  await store.getState().updateConnection('a', { url: 'https://b.example', api: 'v1' })
  assert.equal(store.getState().connections[0].api, 'v1')
})

test('saving the same URL without a probe re-detects the server generation', async () => {
  const { store, release, probes } = harness()
  release(null)
  store.setState({
    connections: [{ id: 'a', name: 'A', url: 'https://a.example', type: 'tunnel', active: true, api: 'v2', serverVersion: '2.0.test' }],
    activeConnection: { id: 'a', name: 'A', url: 'https://a.example', type: 'tunnel', active: true, api: 'v2', serverVersion: '2.0.test' },
  })
  await store.getState().updateConnection('a', { url: 'https://a.example' })
  assert.deepEqual(probes, ['https://a.example'])
})

test('switching the active connection writes the selection once', async () => {
  const { store, release, writes } = harness()
  release(null)
  await store.getState().loadConnections()
  writes.length = 0
  await store.getState().setActiveConnection('a')
  assert.deepEqual(writes, ['opencode_connections'])
})
