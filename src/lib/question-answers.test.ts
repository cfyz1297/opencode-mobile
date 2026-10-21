// Question answer selection helpers — extracted from QuestionPrompt so the
// custom-answer path (BUG: typed text vanished before the user could confirm
// it was sent) is pinned by plain node tests.
import { test } from "node:test"
import assert from "node:assert/strict"
import { applyQuestionAnswer, parseCustomAnswer } from "./question-answers.ts"

test("parseCustomAnswer keeps the typed text and trims surrounding whitespace", () => {
  assert.deepEqual(parseCustomAnswer("  Мой вариант  "), ["Мой вариант"])
})

test("parseCustomAnswer rejects blank input even when non-empty", () => {
  assert.equal(parseCustomAnswer("   \n\t"), null)
})

test("applyQuestionAnswer replaces only the current question and preserves prior answers", () => {
  const before = [["React"], ["TypeScript"]]
  const next = applyQuestionAnswer(before, 1, ["Vue"])
  assert.deepEqual(next, [["React"], ["Vue"]])
  // Must not mutate the state array in place (React state update contract).
  assert.deepEqual(before, [["React"], ["TypeScript"]])
})

test("applyQuestionAnswer copies nested arrays so later edits cannot alias prior state", () => {
  const before = [["React"]]
  const next = applyQuestionAnswer(before, 0, ["Vue"])
  next[0].push("Svelte")
  assert.deepEqual(before, [["React"]])
})

test("applyQuestionAnswer keeps a multi-select answer intact", () => {
  const next = applyQuestionAnswer([[]], 0, ["a", "b"])
  assert.deepEqual(next, [["a", "b"]])
})
