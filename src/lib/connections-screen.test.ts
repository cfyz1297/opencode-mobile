import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')

type Health = { healthy: boolean }

/** Run the actual Connections screen against deterministic native/runtime adapters. */
function screen(health: (client: unknown) => Promise<Health>) {
  const states: unknown[] = []
  const slots: Array<{ deps?: unknown[]; cleanup?: unknown }> = []
  const callbackSlots: Array<{ deps?: unknown[]; value: unknown }> = []
  let cursor = 0
  let callbackCursor = 0
  let mounted = false
  const intervals = new Map<number, () => void>()
  let nextInterval = 1
  const appStateListeners: Array<{ listener: (state: string) => void; active: boolean }> = []
  const routes: string[] = []
  const probed: unknown[] = []
  const first = { id: 'one', name: 'Termux', url: 'http://127.0.0.1:49374', type: 'local' as const, active: true }
  const second = { id: 'two', name: 'Laptop', url: 'http://10.0.0.5:4096', type: 'local' as const, active: false }
  const store: {
    connections: unknown[]
    activeConnection: unknown
    client: unknown
    setActiveConnection: (id: string) => void
    removeConnection: (id: string) => void
  } = {
    connections: [first, second],
    activeConnection: first,
    client: { id: 'client-one' },
    setActiveConnection: () => {},
    removeConnection: () => {},
  }
  const settings = { pageSize: 25, setPageSize: () => {} }

  const same = (a?: unknown[], b?: unknown[]) =>
    a?.length === b?.length && a.every((value, index) => Object.is(value, b?.[index]))
  const react = {
    useCallback: (value: unknown, deps?: unknown[]) => {
      const index = callbackCursor++
      const slot = callbackSlots[index]
      if (slot && same(slot.deps, deps)) return slot.value
      callbackSlots[index] = { deps, value }
      return value
    },
    useMemo: (value: () => unknown) => value(),
    useState: (initial?: unknown) => {
      const index = cursor++
      if (!mounted) states[index] = initial
      return [states[index], (value: unknown) => { states[index] = value }]
    },
    useEffect: (effect: () => unknown, deps?: unknown[]) => {
      const index = cursor++
      if (!mounted) return
      if (same(slots[index]?.deps, deps)) return
      if (typeof slots[index]?.cleanup === 'function') (slots[index]!.cleanup as () => void)()
      slots[index] = { deps, cleanup: effect() }
    },
  }
  const jsx = (type: unknown, props: unknown) => ({ type, props })
  const modules: Record<string, unknown> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      View: 'View',
      Text: 'Text',
      FlatList: 'FlatList',
      TouchableOpacity: 'TouchableOpacity',
      Alert: { alert: () => {} },
      StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
      useColorScheme: () => 'dark',
      AppState: {
        currentState: 'active',
        addEventListener: (_type: string, listener: (state: string) => void) => {
          const entry = { listener, active: true }
          appStateListeners.push(entry)
          return { remove: () => { entry.active = false } }
        },
      },
    },
    'expo-router': {
      router: { push: (url: string) => routes.push(url) },
      useFocusEffect: (callback: () => unknown) => react.useEffect(callback, [callback]),
    },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-i18next': { useTranslation: () => ({ t: (key: string) => key }) },
    '../../src/stores/connections': {
      useConnections: () => store,
    },
    '../../src/stores/settings': { useSettings: () => settings },
    '../../src/lib/connection-health': {
      probeConnection: (client: unknown) => {
        probed.push(client)
        return health(client).then(
          (result) => (result.healthy ? 'online' : 'offline'),
          () => 'offline',
        )
      },
    },
  }

  const output = ts.transpileModule(readFileSync(new URL('../../app/(tabs)/connections.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports: Record<string, () => unknown> = {}
  runInNewContext(output, {
    exports,
    require: (id: string) => {
      if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`)
      return modules[id]
    },
    setInterval: (fn: () => void) => {
      const id = nextInterval++
      intervals.set(id, fn)
      return id
    },
    clearInterval: (id: number) => { intervals.delete(id) },
  })

  const render = () => {
    cursor = 0
    callbackCursor = 0
    const tree = exports.default()
    mounted = true
    return tree
  }
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve))
  }
  const tick = () => { for (const fn of intervals.values()) fn() }
  const unmount = () => {
    for (const slot of slots) if (typeof slot?.cleanup === 'function') (slot.cleanup as () => void)()
  }
  return {
    render,
    settle,
    tick,
    unmount,
    store,
    probed,
    intervals,
    appStateListeners,
    routes,
    fireAppState: (state: string) => { for (const entry of appStateListeners) if (entry.active) entry.listener(state) },
  }
}

function walk(tree: unknown, visit: (node: any) => void) {
  if (!tree || typeof tree !== 'object') return
  visit(tree)
  const children = (tree as { props?: { children?: unknown } }).props?.children
  for (const child of Array.isArray(children) ? children.flat(3) : [children]) walk(child, visit)
}

function texts(tree: unknown): string[] {
  const found: string[] = []
  walk(tree, (node) => {
    if (node.type !== 'Text') return
    const children = node.props?.children
    const value = Array.isArray(children) ? children.join('') : children
    if (typeof value === 'string') found.push(value)
  })
  return found
}

/** Expand function components so their rendered Text/View nodes can be inspected. */
function expand(node: any): any {
  if (!node || typeof node !== 'object') return node
  if (typeof node.type === 'function') return expand(node.type(node.props))
  const children = node.props?.children
  if (children === undefined) return node
  const list = Array.isArray(children) ? children : [children]
  return { ...node, props: { ...node.props, children: list.map(expand) } }
}

function rows(tree: unknown) {
  let list: any = null
  walk(tree, (node) => { if (node.type === 'FlatList') list = node })
  assert.ok(list, 'screen renders the connection list')
  return (list.props.data as unknown[]).map((item) => expand(list.props.renderItem({ item })))
}

test('active connection shows Active only while the server answers', async () => {
  let healthy = false
  const app = screen(async () => ({ healthy }))
  app.render()
  app.render()
  await app.settle()

  let row = rows(app.render())[0]
  assert.deepEqual(app.probed, [app.store.client])
  assert.ok(texts(row).includes('connectionsList.offlineBadge'))
  assert.ok(!texts(row).includes('connectionsList.activeBadge'))

  healthy = true
  app.tick()
  await app.settle()
  row = rows(app.render())[0]
  assert.ok(texts(row).includes('connectionsList.activeBadge'))
  assert.ok(!texts(row).includes('connectionsList.offlineBadge'))
})

test('badge reports a pending check instead of claiming the server is Active', async () => {
  let release: (value: Health) => void = () => {}
  const app = screen(() => new Promise<Health>((resolve) => { release = resolve }))
  app.render()
  app.render()
  await app.settle()

  assert.ok(texts(rows(app.render())[0]).includes('connectionsList.checkingBadge'))

  release({ healthy: true })
  await app.settle()
  assert.ok(texts(rows(app.render())[0]).includes('connectionsList.activeBadge'))
})

test('unreachable server is probed again on interval and on app foreground, then cleaned up', async () => {
  const app = screen(async () => { throw new Error('Network request failed') })
  app.render()
  app.render()
  await app.settle()

  const before = app.probed.length
  assert.equal(before, 1)
  assert.equal(app.intervals.size, 1)
  assert.equal(app.appStateListeners.filter((entry) => entry.active).length, 1)

  app.tick()
  await app.settle()
  assert.equal(app.probed.length, 2)

  app.fireAppState('active')
  await app.settle()
  assert.equal(app.probed.length, 3)

  app.fireAppState('background')
  await app.settle()
  assert.equal(app.probed.length, 3)
  assert.ok(texts(rows(app.render())[0]).includes('connectionsList.offlineBadge'))

  app.unmount()
  assert.equal(app.intervals.size, 0)
  assert.equal(app.appStateListeners.filter((entry) => entry.active).length, 0)
})

test('switching the active connection re-probes with the new client', async () => {
  const app = screen(async () => ({ healthy: true }))
  app.render()
  app.render()
  await app.settle()

  const next = { id: 'client-two' }
  app.store.client = next
  app.store.activeConnection = app.store.connections[1]
  app.render()
  await app.settle()

  assert.deepEqual(app.probed, [{ id: 'client-one' }, next])
  const [, second] = rows(app.render())
  assert.ok(!texts(second).includes('connectionsList.offlineBadge'))
  assert.ok(texts(second).includes('connectionsList.activeBadge'))
})

test('a late answer from the previous connection cannot repaint the new one, and checks never stack', async () => {
  const pending: Array<{ client: unknown; resolve: (health: Health) => void }> = []
  const app = screen((client) => new Promise<Health>((resolve) => pending.push({ client, resolve })))
  app.render()
  app.render()
  await app.settle()
  assert.equal(pending.length, 1)

  app.tick()
  await app.settle()
  assert.equal(pending.length, 1, 'an in-flight probe is not started twice')

  app.store.client = { id: 'client-two' }
  app.store.activeConnection = app.store.connections[1]
  app.render()
  await app.settle()
  assert.equal(pending.length, 2)

  pending[1].resolve({ healthy: false })
  await app.settle()
  assert.ok(texts(rows(app.render())[1]).includes('connectionsList.offlineBadge'))

  pending[0].resolve({ healthy: true })
  await app.settle()
  assert.ok(texts(rows(app.render())[1]).includes('connectionsList.offlineBadge'))
})
