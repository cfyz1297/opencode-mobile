// Quick Connect URL assembly — extracted from app/connection/add.tsx so this
// policy is testable. Every passing test here pins behavior that must hold.
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

// A pasted https:// URL (a public tunnel with no port in it) used to get the
// http-era default ":4096", which no tunnel serves — Quick Connect against any
// https URL always failed. Default port is now scheme-aware (https -> 443).
test("BUG-006: pasted https URL without a port gets :443, not :4096", () => {
  assert.equal(quickConnectUrl("https://demo.example.com", ""), "https://demo.example.com:443")
  assert.equal(quickConnectUrl("http://demo.example.com", ""), "http://demo.example.com:4096")
  assert.equal(quickConnectUrl("https://demo.example.com", "8443"), "https://demo.example.com:8443")
})
