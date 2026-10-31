// Consecutive assistant messages — one per tool step — used to render as a
// stack of full bubbles: repeated "Assistant + model" header, a token/cost line
// and a card gap for every single `shell` call. A long run of tool calls turned
// into a screenful of identical chrome.
//
// The chat list is an inverted FlatList, so its data is newest-first:
// `index - 1` is the newer neighbour in reading order, `index + 1` the older.
// Inside a run, the header belongs to the oldest bubble (top of the run on
// screen) and the token/cost totals to the newest one (bottom).
import { test } from "node:test"
import assert from "node:assert/strict"
import { bubbleFlags, runTotals, runTools } from "./message-run.ts"

test("a lone assistant message shows its header, its reasoning and its token/cost line", () => {
  // Reading order: user, assistant -> inverted ["assistant", "user"].
  assert.deepEqual(bubbleFlags(["user", "assistant"]), [
    { continued: false, showMeta: true, showReasoning: true, showTools: true },
    { continued: false, showMeta: true, showReasoning: true, showTools: true },
  ])
})

test("a run of assistant steps keeps one header, one reasoning row and one token line", () => {
  // Reading order: user, A1, A2, A3 -> inverted [A3, A2, A1, user].
  assert.deepEqual(bubbleFlags(["assistant", "assistant", "assistant", "user"]), [
    { continued: true, showMeta: true, showReasoning: true, showTools: true }, //  A3 — newest step, owns the totals, the reasoning and the tool row
    { continued: true, showMeta: false, showReasoning: false, showTools: false }, // A2 — continuation
    { continued: false, showMeta: false, showReasoning: false, showTools: false }, // A1 — oldest step, shows the header
    { continued: false, showMeta: true, showReasoning: true, showTools: true }, //  user
  ])
})

test("runs break on user and system rows between assistant steps", () => {
  // Reading order: A, user, A, A -> inverted [A, A, user, A].
  const flags = bubbleFlags(["assistant", "assistant", "user", "assistant"])
  assert.deepEqual(flags[0], { continued: true, showMeta: true, showReasoning: true, showTools: true })
  assert.deepEqual(flags[1], { continued: false, showMeta: false, showReasoning: false, showTools: false })
  assert.deepEqual(flags[2], { continued: false, showMeta: true, showReasoning: true, showTools: true })
  assert.deepEqual(flags[3], { continued: false, showMeta: true, showReasoning: true, showTools: true })
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

// One "Ran 2 commands" row per step still repeated the same line down the
// screen. The run's calls belong in one row on its newest step.
const tool = (id: string) => ({ id, type: "tool" as const, tool: "shell" })

test("run tools collect every step of the run onto the newest step", () => {
  // Reading order: user, A1(shell a), A2(shell b), A3 -> inverted [A3, A2, A1, user].
  const items = [
    { role: "assistant", parts: [] as ReturnType<typeof tool>[] },
    { role: "assistant", parts: [tool("b")] },
    { role: "assistant", parts: [tool("a")] },
    { role: "user", parts: [] as ReturnType<typeof tool>[] },
  ]
  assert.deepEqual(
    runTools(items).map((tools) => tools?.map((part) => part.id)),
    [["a", "b"], undefined, undefined, undefined],
  )
})

test("run tools stay undefined for a run without tool calls", () => {
  assert.deepEqual(runTools([{ role: "assistant", parts: [] }, { role: "user" }]), [undefined, undefined])
})
