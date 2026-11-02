import { test } from "node:test"
import assert from "node:assert/strict"
import {
  MAX_MESSAGE_LIMIT,
  MESSAGES_PER_TURN,
  clampTurns,
  countTurns,
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
  assert.equal(clampTurns(0), 1)
  assert.equal(clampTurns(-3), 1)
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
