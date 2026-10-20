// Quick Connect URL assembly — extracted from app/connection/add.tsx so this
// policy is testable. Every passing test here pins behavior that ALREADY holds;
// the skipped test documents the desired behavior for a confirmed bug
// (BUGS.md#BUG-006) — un-skip it when the bug is fixed.
import { test } from "node:test"
import assert from "node:assert/strict"
import { quickConnectUrl } from "./quick-connect-url.ts"

test("quickConnectUrl: bare IP gets the http default port 4096", () => {
  assert.equal(quickConnectUrl("192.168.1.5", ""), "http://192.168.1.5:4096")
})

test("quickConnectUrl: explicit port field wins over the default", () => {
  assert.equal(quickConnectUrl("192.168.1.5", "1234"), "http://192.168.1.5:1234")
})

test("quickConnectUrl: pasted host:port keeps the pasted port", () => {
  assert.equal(quickConnectUrl("10.0.0.2:5555", ""), "http://10.0.0.2:5555")
})

test("quickConnectUrl: pasted scheme is kept", () => {
  assert.equal(quickConnectUrl("https://demo.example.com:8443", ""), "https://demo.example.com:8443")
  assert.equal(quickConnectUrl("HTTP://demo.example.com", ""), "http://demo.example.com:4096")
})

test("quickConnectUrl: path/query on a pasted URL is dropped", () => {
  assert.equal(quickConnectUrl("http://10.0.0.2:5555/logs?all=1", ""), "http://10.0.0.2:5555")
})

test("quickConnectUrl: whitespace-only input yields empty string", () => {
  assert.equal(quickConnectUrl("   ", ""), "")
})

// BUG-006 (https://github.com/…/BUGS.md): a pasted https:// URL (a public
// tunnel with no port in it) is handed the http-era default ":4096", which no
// tunnel serves — Quick Connect against any https URL always fails to connect.
// Expected: a scheme that came from the pasted value must not fall back to the
// :4096 default; only a bare host typed without a scheme should.
test.skip("BUG-006: pasted https URL without a port must not get :4096 appended", () => {
  assert.equal(quickConnectUrl("https://demo.example.com", ""), "https://demo.example.com")
  assert.equal(quickConnectUrl("http://demo.example.com", ""), "http://demo.example.com")
})
