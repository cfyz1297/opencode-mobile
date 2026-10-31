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
    part("tool", { tool: "bash" }),
    part("reasoning", { text: "next" }),
    part("tool", { tool: "bash" }),
  ]
  assert.deepEqual(
    groupParts(parts).map((item) => item.kind),
    ["reasoning", "text", "tools", "reasoning", "tools"],
  )
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
  assert.equal(isCommandRun([part("tool", { tool: "bash" }), part("tool", { tool: "read" })]), false)
  assert.equal(isCommandRun([]), false)
})
