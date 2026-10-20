import { test } from "node:test"
import assert from "node:assert/strict"
import { mergeIncomingMessage, reconcileTemps } from "./message-merge.ts"
import type { Message, Part } from "./sdk.ts"

const msg = (id: string, role: "user" | "assistant" = "user", created = 1): Message => ({
  id,
  sessionID: "s1",
  role,
  time: { created },
} as Message)

const textPart = (messageID: string, text: string): Part => ({
  id: `${messageID}-t`,
  messageID,
  type: "text",
  text,
})

const filePart = (messageID: string): Part => ({
  id: `${messageID}-f`,
  messageID,
  type: "file",
  mime: "image/jpeg",
  url: `blob:${messageID}`,
  filename: "photo.jpg",
})

test("appends an assistant reply that has no optimistic placeholder", () => {
  const out = mergeIncomingMessage([msg("temp-1", "user")], msg("real-a", "assistant"))
  assert.deepEqual(out.map((m) => m.id), ["temp-1", "real-a"])
})

test("replaces the single pending temp user message", () => {
  const out = mergeIncomingMessage([msg("temp-1", "user")], msg("real-1", "user"))
  assert.deepEqual(out.map((m) => m.id), ["real-1"])
})

test("resolving the first message keeps a second queued temp message (the bug)", () => {
  // User sent msg1 (temp-1) then msg2 (temp-2) while msg1 was still processing.
  const list = [msg("temp-1", "user"), msg("temp-2", "user")]
  // The real event for msg1 arrives first.
  const out = mergeIncomingMessage(list, msg("real-1", "user"))
  // temp-1 is resolved; temp-2 must remain so it doesn't vanish from the UI.
  assert.deepEqual(out.map((m) => m.id), ["real-1", "temp-2"])
})

test("updates an already-present message in place without reordering", () => {
  const list = [msg("real-1", "user"), msg("real-2", "assistant")]
  const updated: Message = { ...msg("real-2", "assistant"), time: { created: 1, completed: 9 } }
  const out = mergeIncomingMessage(list, updated)
  assert.deepEqual(out.map((m) => m.id), ["real-1", "real-2"])
  assert.equal(out[1].time.completed, 9)
})

test("appends a real message when there is no matching temp and it is new", () => {
  const out = mergeIncomingMessage([msg("real-1", "user")], msg("real-2", "user"))
  assert.deepEqual(out.map((m) => m.id), ["real-1", "real-2"])
})

test("does not remove a temp of a different role", () => {
  const out = mergeIncomingMessage([msg("temp-1", "user")], msg("real-a", "assistant"))
  assert.ok(out.some((m) => m.id === "temp-1"))
})

// --- reconcileTemps ---

test("reconcileTemps passes fetched messages through when no temps are pending", () => {
  const fetched = [msg("m1", "user", 1000)]
  const parts = { m1: [textPart("m1", "hi")] }
  const out = reconcileTemps(fetched, parts, [], {})
  assert.deepEqual(out.messages.map((m) => m.id), ["m1"])
  assert.equal(out.parts.m1?.[0].text, "hi")
})

test("reconcileTemps drops a temp once its server copy is in the list", () => {
  const temp = msg("temp-900", "user", 900)
  const real = msg("real-1000", "user", 1000)
  const out = reconcileTemps(
    [real],
    { "real-1000": [textPart("real-1000", "Проверка")] },
    [temp],
    { "temp-900": [textPart("temp-900", "Проверка")] },
  )
  assert.deepEqual(out.messages.map((m) => m.id), ["real-1000"])
  assert.equal(out.parts["temp-900"], undefined)
})

test("reconcileTemps keeps a temp whose copy is still missing (run in flight)", () => {
  const temp = msg("temp-900", "user", 900)
  const out = reconcileTemps(
    [msg("m1", "assistant", 700)],
    { m1: [textPart("m1", "answer")] },
    [temp],
    { "temp-900": [textPart("temp-900", "Проверка")] },
  )
  assert.deepEqual(out.messages.map((m) => m.id), ["m1", "temp-900"])
  assert.equal(out.parts["temp-900"]?.[0].text, "Проверка")
})

test("reconcileTemps FIFO-pairs repeated identical texts", () => {
  // "Проверка" sent twice: two temps, now two server copies.
  const temps = [msg("temp-900", "user", 900), msg("temp-950", "user", 950)]
  const fetched = [msg("real-1000", "user", 1000), msg("real-1010", "user", 1010)]
  const partsFor = (id: string) => [textPart(id, "Проверка")]
  const out = reconcileTemps(
    fetched,
    { "real-1000": partsFor("real-1000"), "real-1010": partsFor("real-1010") },
    temps,
    { "temp-900": partsFor("temp-900"), "temp-950": partsFor("temp-950") },
  )
  // Both temps resolved, both real copies kept, correct order.
  assert.deepEqual(out.messages.map((m) => m.id), ["real-1000", "real-1010"])
})

test("reconcileTemps does not consume an unrelated older copy of the same text", () => {
  // An old server copy of the same text from long before this send must
  // survive, and the still-unmatched temp stays visible (until its real copy
  // arrives on a later refresh).
  const temp = msg("temp-900000", "user", 900_000)
  const olderCopy = msg("real-100", "user", 100)
  const out = reconcileTemps(
    [olderCopy],
    { "real-100": [textPart("real-100", "Проверка")] },
    [temp],
    { "temp-900000": [textPart("temp-900000", "Проверка")] },
  )
  assert.deepEqual(out.messages.map((m) => m.id), ["real-100", "temp-900000"])
})

test("reconcileTemps pairs image-only messages by file count", () => {
  const temp = msg("temp-900", "user", 900)
  const real = msg("real-1000", "user", 1000)
  const out = reconcileTemps(
    [real],
    { "real-1000": [filePart("real-1000")] },
    [temp],
    { "temp-900": [filePart("temp-900")] },
  )
  assert.deepEqual(out.messages.map((m) => m.id), ["real-1000"])
});
