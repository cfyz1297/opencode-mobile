import { test } from "node:test"
import assert from "node:assert/strict"
import { groupParts, isCommandRun } from "./part-runs.ts"
import type { Part } from "./sdk.ts"

function part(type: Part["type"], extra: Partial<Part> = {}): Part {
  return { id: `${type}-${Math.random()}`, messageID: "m", type, ...extra }
}

test("groupParts keeps the model's order instead of regrouping by type", () => {
  const parts = [
    part("reasoning", { text: "plan" }),
    part("text", { text: "answer" }),
    part("tool", { tool: "shell" }),
    part("reasoning", { text: "next" }),
    part("tool", { tool: "shell" }),
  ]
  // Text closes the group: the two shell calls after it are one row, and the
  // reasoning between them must not split it. A segment always reads
  // reasoning-then-tools, so the thought that came second leads its segment.
  assert.deepEqual(
    groupParts(parts).map((item) => item.kind),
    ["reasoning", "text", "reasoning", "tools"],
  )
  const tools = groupParts(parts)[3]
  assert.equal(tools.kind === "tools" && tools.tools.length, 2)
})

test("groupParts folds reasoning split by tool calls into one block", () => {
  const items = groupParts([
    part("reasoning", { text: "first" }),
    part("tool", { tool: "shell" }),
    part("reasoning", { text: "second" }),
    part("tool", { tool: "shell" }),
    part("text", { text: "done" }),
  ])
  assert.deepEqual(
    items.map((item) => item.kind),
    ["reasoning", "tools", "text"],
  )
  const reasoning = items[0]
  assert.equal(reasoning.kind === "reasoning" && reasoning.part.text, "first\n\nsecond")
  // A merged block spans several steps, so a per-block duration would lie.
  assert.equal(reasoning.kind === "reasoning" && reasoning.part.time, undefined)
})

test("groupParts folds consecutive tool calls into one run", () => {
  const tools = [part("tool", { tool: "bash" }), part("tool", { tool: "bash" }), part("tool", { tool: "read" })]
  const items = groupParts([part("text", { text: "go" }), ...tools])
  assert.equal(items.length, 2)
  assert.equal(items[1].kind, "tools")
  assert.equal(items[1].kind === "tools" && items[1].tools.length, 3)
})

test("groupParts does not join tool calls split by text", () => {
  const items = groupParts([
    part("tool", { tool: "bash" }),
    part("text", { text: "between" }),
    part("tool", { tool: "bash" }),
  ])
  assert.deepEqual(
    items.map((item) => item.kind),
    ["tools", "text", "tools"],
  )
})

test("groupParts drops bookkeeping and empty parts", () => {
  const items = groupParts([
    part("step-start"),
    part("text", { text: "" }),
    part("reasoning"),
    part("snapshot"),
    part("file", { mime: "image/png" }),
    part("text", { text: "kept" }),
  ])
  assert.equal(items.length, 1)
  assert.equal(items[0].kind, "text")
})

test("groupParts on an empty list is empty", () => {
  assert.deepEqual(groupParts([]), [])
})

test("isCommandRun is true only for shell-only runs", () => {
  assert.equal(isCommandRun([part("tool", { tool: "bash" })]), true)
  // V2 renamed the tool: real runs report `shell`, which used to fall through
  // to the generic "Ran N tools" label.
  assert.equal(isCommandRun([part("tool", { tool: "shell" })]), true)
  assert.equal(isCommandRun([part("tool", { tool: "shell" }), part("tool", { tool: "read" })]), false)
  assert.equal(isCommandRun([]), false)
})
