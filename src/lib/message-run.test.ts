// Consecutive assistant messages — one per tool step — used to render as a
// stack of full bubbles: repeated "Assistant + model" header and a token/cost
// line for every single `shell` call. A long run of tool calls turned into a
// screenful of identical chrome.
//
// The chat list is an inverted FlatList, so its data is newest-first:
// `index - 1` is the newer neighbour in reading order, `index + 1` the older.
// Inside a run, the header belongs to the oldest bubble (top of the run on
// screen) and the token/cost totals to the newest one (bottom).
import { test } from "node:test"
import assert from "node:assert/strict"
import { bubbleFlags, runTotals } from "./message-run.ts"

test("a lone assistant message shows its header and its token/cost line", () => {
  // Reading order: user, assistant -> inverted ["assistant", "user"].
  assert.deepEqual(bubbleFlags(["user", "assistant"]), [
    { continued: false, showMeta: true },
    { continued: false, showMeta: true },
  ])
})

test("a run of assistant steps keeps one header and one token line", () => {
  // Reading order: user, A1, A2, A3 -> inverted [A3, A2, A1, user].
  assert.deepEqual(bubbleFlags(["assistant", "assistant", "assistant", "user"]), [
    { continued: true, showMeta: true }, //  A3 — newest step, owns the totals
    { continued: true, showMeta: false }, // A2 — continuation
    { continued: false, showMeta: false }, // A1 — oldest step, shows the header
    { continued: false, showMeta: true }, //  user
  ])
})

test("runs break on user and system rows between assistant steps", () => {
  // Reading order: A, user, A, A -> inverted [A, A, user, A].
  const flags = bubbleFlags(["assistant", "assistant", "user", "assistant"])
  assert.deepEqual(flags[0], { continued: true, showMeta: true })
  assert.deepEqual(flags[1], { continued: false, showMeta: false })
  assert.deepEqual(flags[2], { continued: false, showMeta: true })
  assert.deepEqual(flags[3], { continued: false, showMeta: true })
})

test("empty list yields no flags", () => {
  assert.deepEqual(bubbleFlags([]), [])
})

// The footer used to show only the last step's own cost, so a ten-step run
// reported a fraction of what it actually cost. Totals belong to the newest
// step and must cover every assistant step of that run.
test("run totals sum every step of the run and land on the newest step", () => {
  const totals = runTotals([
    { role: "assistant", tokens: { input: 10, output: 2 }, cost: 0.25 }, // A3 newest
    { role: "assistant", tokens: { input: 20, output: 4 }, cost: 0.25 }, // A2
    { role: "assistant", tokens: { input: 30, output: 6 }, cost: 0.5 }, // A1 oldest
    { role: "user" },
  ])
  assert.deepEqual(totals, [{ tokens: 72, cost: 1 }, undefined, undefined, undefined])
})

test("run totals cover a lone assistant message", () => {
  assert.deepEqual(runTotals([{ role: "assistant", tokens: { input: 3, output: 1 }, cost: 0.5 }, { role: "user" }]), [
    { tokens: 4, cost: 0.5 },
    undefined,
  ])
})

test("run totals stop at a user message", () => {
  // Reading order: A, user, A -> inverted [A, user, A].
  assert.deepEqual(
    runTotals([
      { role: "assistant", tokens: { input: 1, output: 1 }, cost: 1 },
      { role: "user" },
      { role: "assistant", tokens: { input: 2, output: 2 }, cost: 2 },
    ]),
    [{ tokens: 2, cost: 1 }, undefined, { tokens: 4, cost: 2 }],
  )
})

test("run totals stay undefined when the server sent no usage", () => {
  assert.deepEqual(runTotals([{ role: "assistant" }, { role: "user" }]), [undefined, undefined])
  assert.deepEqual(runTotals([]), [])
})
