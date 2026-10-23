import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tunnelUrl, tunnelCommands } from './tunnel.ts'

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
