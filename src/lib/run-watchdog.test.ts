import { test } from "node:test"
import assert from "node:assert/strict"
import { runsNeedingResync, RUN_QUIET_MS } from "./run-watchdog.ts"

// Regression pin for "the answer never appears until the session is reopened":
// SSE can stay healthy (heartbeats keep the socket check quiet) while the
// events of one running session are lost. The stream watchdog can't see that,
// so each run needs its own silence check.

const now = 1_000_000

test("a run silent past the window needs a transcript resync", () => {
  const runs = [{ sessionID: "s1", lastEventAt: now - RUN_QUIET_MS }]
  assert.deepEqual(runsNeedingResync(runs, now), ["s1"])
})

test("a run with recent events is left alone", () => {
  assert.deepEqual(runsNeedingResync([{ sessionID: "s1", lastEventAt: now - 1 }], now), [])
  assert.deepEqual(runsNeedingResync([{ sessionID: "s1", lastEventAt: now - RUN_QUIET_MS + 1 }], now), [])
})

test("quiet runs are reported independently", () => {
  const runs = [
    { sessionID: "quiet", lastEventAt: now - RUN_QUIET_MS * 2 },
    { sessionID: "live", lastEventAt: now },
    { sessionID: "also-quiet", lastEventAt: now - RUN_QUIET_MS },
  ]
  assert.deepEqual(runsNeedingResync(runs, now), ["quiet", "also-quiet"])
})

test("no resync storm: one attempt per quiet window", () => {
  const runs = [{ sessionID: "s1", lastEventAt: now - RUN_QUIET_MS, lastResyncAt: now - 1 }]
  assert.deepEqual(runsNeedingResync(runs, now), [])
  assert.deepEqual(runsNeedingResync([{ ...runs[0], lastResyncAt: now - RUN_QUIET_MS }], now), ["s1"])
})

test("an idle session never triggers a resync", () => {
  const runs = [{ sessionID: "s1", lastEventAt: now - RUN_QUIET_MS * 100, idle: true }]
  assert.deepEqual(runsNeedingResync(runs, now), [])
})

test("window is overridable for tests", () => {
  assert.deepEqual(runsNeedingResync([{ sessionID: "s1", lastEventAt: now - 500 }], now, 500), ["s1"])
})
