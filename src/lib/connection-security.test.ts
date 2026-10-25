import { test } from "node:test"
import assert from "node:assert/strict"
import { sendsPasswordInClearText } from "./connection-security.ts"

test("plain http to a LAN address crosses the network in clear text", () => {
  assert.equal(sendsPasswordInClearText("http://192.168.1.100:4096"), true)
  assert.equal(sendsPasswordInClearText("http://10.0.0.5:4096"), true)
  assert.equal(sendsPasswordInClearText("http://my-mac.tailnet.ts.net:4096"), true)
  assert.equal(sendsPasswordInClearText("  http://192.168.1.100:4096/  "), true)
})

test("https never warns, whatever the host", () => {
  assert.equal(sendsPasswordInClearText("https://my-mac.tailnet.ts.net"), false)
  assert.equal(sendsPasswordInClearText("HTTPS://example.test:8443"), false)
})

test("loopback traffic never leaves the device, so it never warns", () => {
  assert.equal(sendsPasswordInClearText("http://127.0.0.1:49374"), false)
  assert.equal(sendsPasswordInClearText("http://127.1.2.3:4096"), false)
  assert.equal(sendsPasswordInClearText("http://localhost:4096"), false)
  assert.equal(sendsPasswordInClearText("http://LOCALHOST:4096"), false)
  assert.equal(sendsPasswordInClearText("http://0.0.0.0:4096"), false)
  assert.equal(sendsPasswordInClearText("http://[::1]:4096"), false)
  assert.equal(sendsPasswordInClearText("http://[0:0:0:0:0:0:0:1]:4096"), false)
})

test("an incomplete URL is not a warning yet", () => {
  assert.equal(sendsPasswordInClearText(""), false)
  assert.equal(sendsPasswordInClearText("192.168.1.100"), false)
  assert.equal(sendsPasswordInClearText("192.168.1.100:4096"), false)
})
