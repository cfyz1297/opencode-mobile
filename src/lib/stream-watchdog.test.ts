import { test } from "node:test"
import assert from "node:assert/strict"
import { isStreamStalled, STREAM_STALL_MS } from "./stream-watchdog.ts"

// Regression pin for the "Работаю..." hang: a stream that dies without a FIN
// keeps `connected: true` while no bytes arrive, so only a silence check can
// recover it. False positives cost a reconnect, so idle silence must never
// trigger one.

const base = { activeRun: true, lastActivityAt: 1_000_000, now: 1_000_000 + STREAM_STALL_MS }

test("silent stream during a run is stalled", () => {
  assert.equal(isStreamStalled(base), true)
})

test("fresh heartbeat during a run is not stalled", () => {
  assert.equal(isStreamStalled({ ...base, now: base.lastActivityAt + 1 }), false)
  assert.equal(isStreamStalled({ ...base, now: base.lastActivityAt + STREAM_STALL_MS - 1 }), false)
})

test("idle silence never reconnects", () => {
  assert.equal(isStreamStalled({ ...base, activeRun: false, now: base.lastActivityAt + 10 * 60_000 }), false)
})

test("stall threshold is overridable for tests", () => {
  assert.equal(isStreamStalled({ ...base, now: base.lastActivityAt + 500, stallMs: 500 }), true)
})
