import { test } from "node:test"
import assert from "node:assert/strict"
import { computeSessionStats, fillColor } from "./session-stats.ts"
import type { Message } from "./sdk.ts"

const providers = [
  { id: "go", models: [{ id: "m1", limit: { context: 1000 } }, { id: "nomatch" }] },
]

function assistant(cost: number | undefined, tokens?: Message["tokens"], model = "m1"): Message {
  return {
    id: `a${Math.random()}`,
    sessionID: "s",
    role: "assistant",
    time: { created: 0 },
    providerID: "go",
    modelID: model,
    cost,
    tokens,
  }
}

test("cost sums the assistant turns when the session record has none", () => {
  const stats = computeSessionStats([assistant(0.5), assistant(0.25)], providers, null)
  assert.equal(stats.cost, 0.75)
})

test("the session record wins: the message page is only part of the session", () => {
  // loadOlderMessages / a paged open means `messages` is not the whole session,
  // so summing it understates the spend. The session record is cumulative.
  const stats = computeSessionStats([assistant(0.5)], providers, { cost: 3.25 })
  assert.equal(stats.cost, 3.25)
})

test("a zero session cost falls back to the summed cost", () => {
  assert.equal(computeSessionStats([assistant(0.5)], providers, { cost: 0 }).cost, 0.5)
})

test("context usage is the last assistant turn against the model's window", () => {
  const stats = computeSessionStats(
    [
      assistant(0, { input: 100, output: 50, cache: { read: 0, write: 0 } }),
      assistant(0, { input: 300, output: 100, reasoning: 50, cache: { read: 50, write: 0 } }),
    ],
    providers,
    null,
  )
  assert.equal(stats.total, 500)
  assert.equal(stats.context, 1000)
  assert.equal(stats.percent, 50)
})

test("an unknown model window reports 0% instead of dividing by zero", () => {
  // `nomatch` exists but declares no context limit; an unknown model is the
  // same case — without this guard percent became NaN and the ring rendered
  // nothing at all.
  const stats = computeSessionStats([assistant(0, { input: 10, output: 5 }, "nomatch")], providers, null)
  assert.equal(stats.context, 0)
  assert.equal(stats.percent, 0)
})

test("percent is clamped to 100 so the ring cannot draw past full", () => {
  const stats = computeSessionStats([assistant(0, { input: 5000, output: 5000 })], providers, null)
  assert.equal(stats.percent, 100)
})

test("fill colour escalates with usage", () => {
  assert.equal(fillColor(10), "#3b82f6")
  assert.equal(fillColor(50), "#3b82f6")
  assert.equal(fillColor(51), "#f59e0b")
  assert.equal(fillColor(80), "#f59e0b")
  assert.equal(fillColor(81), "#ef4444")
})
