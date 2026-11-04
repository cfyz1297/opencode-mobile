import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ALL_TURNS,
  MAX_MESSAGE_LIMIT,
  MAX_TURNS,
  MESSAGES_PER_TURN,
  clampTurns,
  countTurns,
  isWholeSession,
  keepLoadedHistory,
  messageLimitForTurns,
  trimToTurns,
} from "./message-page.ts"

const turn = (n: number) => [
  { role: "user", n },
  { role: "assistant", n },
  { role: "assistant", n },
  { role: "assistant", n },
]

test("a page is requested per exchange, not per message", () => {
  assert.equal(messageLimitForTurns(5), 5 * MESSAGES_PER_TURN)
  assert.equal(messageLimitForTurns(50), MAX_MESSAGE_LIMIT, "never exceeds the server's cap")
})

test("turns are clamped to a sane range", () => {
  assert.equal(clampTurns(-3), 1, "a negative value is nonsense, not the sentinel")
  assert.equal(clampTurns(999), 50)
  assert.equal(clampTurns(Number.NaN), 1)
  assert.equal(clampTurns(12.9), 12)
})

test("only user messages count as exchanges", () => {
  assert.equal(countTurns([...turn(1), ...turn(2)]), 2)
  assert.equal(countTurns([]), 0)
})

test("the page keeps the newest exchanges and everything after the oldest kept prompt", () => {
  const messages = [...turn(1), ...turn(2), ...turn(3)]
  const { messages: page, trimmed } = trimToTurns(messages, 2)
  assert.equal(trimmed, true)
  assert.equal(countTurns(page), 2)
  assert.equal(page[0].role, "user", "a page starts with the user's prompt, not mid-exchange")
  assert.equal(page[0].n, 2)
  assert.equal(page.length, 8)
})

test("a session shorter than the page is returned whole and is not trimmed", () => {
  const messages = [...turn(1), ...turn(2)]
  const { messages: page, trimmed } = trimToTurns(messages, 10)
  assert.equal(trimmed, false)
  assert.equal(page.length, messages.length)
})

test("a window with no user message cannot be measured, so it is kept whole", () => {
  const messages = [{ role: "assistant" }, { role: "assistant" }]
  const { messages: page, trimmed } = trimToTurns(messages, 1)
  assert.equal(trimmed, false)
  assert.equal(page.length, 2)
})

test("trimming returns a copy, so the caller's array is never mutated", () => {
  const messages = [...turn(1)]
  const { messages: page } = trimToTurns(messages, 1)
  page.pop()
  assert.equal(messages.length, 4)
})

// --- keepLoadedHistory -------------------------------------------------------

const msg = (id: string) => ({ id })

test("a refresh keeps the older messages the screen already loaded", () => {
  // loadOlderMessages had pulled everything (hasMore=false); this refresh only
  // fetched the newest page. Keeping just the page made history vanish until
  // the session was reopened.
  const previous = ["m1", "m2", "m3", "m4", "m5"].map(msg)
  const page = ["m3", "m4", "m5"].map(msg)
  assert.deepEqual(keepLoadedHistory(page, previous, true).map((m) => m.id), ["m1", "m2", "m3", "m4", "m5"])
})

test("a refresh picks up messages added while it was in flight", () => {
  const previous = ["m1", "m2"].map(msg)
  const page = ["m2", "m3"].map(msg)
  assert.deepEqual(keepLoadedHistory(page, previous, true).map((m) => m.id), ["m1", "m2", "m3"])
})

test("only messages older than the page survive — a revert cleanup deletes the rest", () => {
  // The server removed everything after the revert point; those ids are newer
  // than the page's first message and must not be resurrected.
  const previous = ["m1", "m2", "m7", "m8"].map(msg)
  const page = ["m1", "m2", "m9"].map(msg)
  assert.deepEqual(keepLoadedHistory(page, previous, true).map((m) => m.id), ["m1", "m2", "m9"])
})

test("a cold load or an untrimmed page is used verbatim", () => {
  const previous = ["m1", "m2"].map(msg)
  const page = ["m2", "m3"].map(msg)
  assert.deepEqual(keepLoadedHistory(page, previous, false).map((m) => m.id), ["m2", "m3"])
  assert.deepEqual(keepLoadedHistory(page, [], true).map((m) => m.id), ["m2", "m3"])
})

test("a page that already covers the history is not duplicated", () => {
  const previous = ["m1", "m2", "m3"].map(msg)
  const page = ["m1", "m2", "m3"].map(msg)
  assert.deepEqual(keepLoadedHistory(page, previous, true).map((m) => m.id), ["m1", "m2", "m3"])
})

// --- whole session (ALL_TURNS) ----------------------------------------------

test("ALL_TURNS is passed through by clamp and asks for the largest page", () => {
  assert.equal(clampTurns(ALL_TURNS), ALL_TURNS)
  assert.equal(clampTurns(0), ALL_TURNS, "0 is the sentinel, not 'clamp up to 1'")
  assert.equal(messageLimitForTurns(ALL_TURNS), MAX_MESSAGE_LIMIT)
  assert.equal(isWholeSession(ALL_TURNS), true)
  assert.equal(isWholeSession(50), false)
})

test("a whole-session page is never trimmed, so hasMore stays false", () => {
  const messages = [
    ...Array.from({ length: 40 }, (_, i) => ({ role: "user", id: `u${i}` })),
    ...Array.from({ length: 40 }, (_, i) => ({ role: "assistant", id: `a${i}` })),
  ]
  const page = trimToTurns(messages, ALL_TURNS)
  assert.equal(page.messages.length, 80)
  assert.equal(page.trimmed, false)
})

test("the numeric maximum still trims, so ALL_TURNS is genuinely wider", () => {
  const messages = Array.from({ length: 60 }, (_, i) => ({ role: "user", id: `u${i}` }))
  assert.equal(trimToTurns(messages, MAX_TURNS).messages.length, MAX_TURNS)
  assert.equal(trimToTurns(messages, ALL_TURNS).messages.length, 60)
})
