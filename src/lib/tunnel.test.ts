import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tunnelUrl, tunnelCommands, createTunnelConnector } from './tunnel.ts'

test('tunnel preserves HTTPS origin and reverse proxy path', () => {
  assert.equal(tunnelUrl(' https://my-host.ngrok-free.app/proxy/ '), 'https://my-host.ngrok-free.app/proxy')
})
test('tunnel rejects credentials, insecure schemes, query secrets and malformed ports', () => {
  for (const url of ['http://host.test', 'https://user:pass@host.test', 'javascript:alert(1)', 'https://host.test?token=x', 'https://host.test/#x', 'https://host.test:70000', 'https://host.test\\@evil.test', 'https://host.test\n.evil.test']) {
    assert.throws(() => tunnelUrl(url), url)
  }
})
test('commands bind server to loopback and never interpolate an invalid port', () => {
  assert.match(tunnelCommands('cloudflare', '4096', 'windows').join('\n'), /127\.0\.0\.1/)
  assert.match(tunnelCommands('ngrok', '4096', 'unix').join('\n'), /ngrok http 4096/)
  for (const port of ['0', '65536', '4096;whoami', '-1', '1.5']) assert.throws(() => tunnelCommands('ngrok', port, 'unix'))
})
test('Cloudflare setup uses named tunnel because quick tunnels do not support SSE', () => {
  const commands = tunnelCommands('cloudflare', '4096', 'windows')
  assert.match(commands[1], /tunnel run --token YOUR_TUNNEL_TOKEN/)
  assert.ok(!commands[1].includes('--url'))
  assert.throws(() => tunnelUrl('https://random.trycloudflare.com'), /named Cloudflare tunnel/)
})
function connectorHarness(overrides: Record<string, unknown> = {}) {
  const calls: unknown[][] = []
  const connector = createTunnelConnector({
    test: async (connection, password) => { calls.push(['test', connection, password]); return { ok: true } },
    add: async (connection, password) => { calls.push(['add', connection, password]); return 'added-id' },
    activate: async id => { calls.push(['activate', id]) },
    ...overrides,
  })
  return { connector, calls }
}
const input = { url: 'https://tunnel.example/reverse/', username: ' alice ', password: 'dummy-password', provider: 'cloudflare' as const }
test('successful wizard tests auth, saves exact profile, then activates returned ID', async () => {
  const { connector, calls } = connectorHarness()
  assert.equal(await connector(input), 'added-id')
  assert.deepEqual(calls.map(call => call[0]), ['test', 'add', 'activate'])
  assert.deepEqual(calls[0].slice(1), [{ name: 'Cloudflare tunnel', type: 'tunnel', url: 'https://tunnel.example/reverse', username: 'alice' }, 'dummy-password'])
  assert.deepEqual(calls[2], ['activate', 'added-id'])
})
test('wizard rejects insecure URL and empty password before contacting server', async () => {
  const { connector, calls } = connectorHarness()
  await assert.rejects(connector({ ...input, url: 'http://tunnel.example' }))
  await assert.rejects(connector({ ...input, password: '' }))
  assert.equal(calls.length, 0)
})
test('authentication failure never creates a profile; save failure never activates it', async () => {
  const rejected = connectorHarness({ test: async () => ({ ok: false }) })
  await assert.rejects(rejected.connector(input))
  assert.equal(rejected.calls.length, 0)
  const failed = connectorHarness({ add: async () => { throw new Error('Keystore full') } })
  await assert.rejects(failed.connector(input))
  assert.equal(failed.calls.length, 1)
})
test('double submit is ignored while pending and failures allow retry', async () => {
  let release!: (value: { ok: boolean }) => void
  const gate = new Promise<{ ok: boolean }>(resolve => { release = resolve })
  const { connector, calls } = connectorHarness({ test: () => gate })
  const first = connector(input)
  assert.equal(await connector(input), null)
  release({ ok: true }); await first
  assert.equal(calls.length, 2)
  assert.equal(await connector(input), 'added-id')
})
