// Revert visibility filter — extracted from app/session/[id].tsx messageData.
// Pins the lexicographic hide-window semantics while a revert is pending.
import { test } from "node:test"
import assert from "node:assert/strict"
import { isHiddenByRevert, buildMessageData } from "./revert-filter.ts"
import type { Message, Part } from "./sdk"

// isHiddenByRevert -----------------------------------------------------------

test("no pending revert: nothing is hidden", () => {
  assert.equal(isHiddenByRevert("msg_001", undefined), false)
  assert.equal(isHiddenByRevert("msg_001", null), false)
  assert.equal(isHiddenByRevert("temp-1700", undefined), false)
})

test("pending revert: the revert point itself and everything after is hidden", () => {
  // IDs are lexicographically sortable (same comparison the TUI uses).
  assert.equal(isHiddenByRevert("msg_002", "msg_002"), true) // >= point -> hidden
  assert.equal(isHiddenByRevert("msg_003", "msg_002"), true)
  assert.equal(isHiddenByRevert("msg_001", "msg_002"), false) // strictly before
})

test("pending revert: optimistic temp- messages are never hidden", () => {
  assert.equal(isHiddenByRevert("temp-1700000000000", "msg_002"), false)
})

// buildMessageData ------------------------------------------------------------

function msg(id: string, role: "user" | "assistant" = "user"): Message {
  return { id, sessionID: "s", role, time: { created: 0 } }
}

const partsOf = (ids: string[]): Record<string, Part[]> =>
  Object.fromEntries(ids.map((id) => [id, [{ id: `${id}_p1`, messageID: id, type: "text", text: `t-${id}` }]]))

test("buildMessageData: no revert -> all messages, reversed (newest first), parts attached", () => {
  const data = buildMessageData([msg("m1"), msg("m2")], partsOf(["m1", "m2"]), undefined)
  assert.deepEqual(
    data.map((d) => d.message.id),
    ["m2", "m1"],
  )
  assert.equal(data[0].parts.length, 1)
  assert.equal(data[0].parts[0].type, "text")
})

test("buildMessageData: messages before the revert point stay visible with their parts", () => {
  const ids = ["m1", "m2", "m3"]
  const data = buildMessageData(ids.map(msg), partsOf(ids), "m2")
  // m2 (the point) and m3 hidden; m1 kept.
  assert.deepEqual(
    data.map((d) => d.message.id),
    ["m1"],
  )
})

test("buildMessageData: temp messages survive even past the revert point", () => {
  // The revert point itself is hidden (hide window is >=), temps are kept.
  const data = buildMessageData([msg("m1"), msg("temp-171"), msg("m3")], {}, "m1")
  assert.deepEqual(
    data.map((d) => d.message.id),
    ["temp-171"],
  )
})

test("buildMessageData: missing parts and undefined parts maps degrade to empty arrays", () => {
  const data = buildMessageData([msg("m1")], {}, undefined)
  assert.deepEqual(data[0].parts, [])
})

test("buildMessageData: cache keeps unchanged items referentially stable across streaming deltas", () => {
  const messages = [msg("m1"), msg("m2")]
  const baseParts = partsOf(["m1", "m2"])
  const cache = new Map<string, { message: Message; parts: Part[] }>()

  const first = buildMessageData(messages, baseParts, undefined, cache)
  const firstM1 = first.find((item) => item.message.id === "m1")!
  const firstM2 = first.find((item) => item.message.id === "m2")!

  // A streaming delta replaces only m2's parts array, not the message list.
  const streamedParts = { ...baseParts, m2: [...(baseParts.m2 ?? [])] }
  const second = buildMessageData(messages, streamedParts, undefined, cache)

  assert.equal(second.find((item) => item.message.id === "m1"), firstM1)
  assert.notEqual(second.find((item) => item.message.id === "m2"), firstM2)
  assert.equal(cache.get("m1")?.message, messages[0])
})
