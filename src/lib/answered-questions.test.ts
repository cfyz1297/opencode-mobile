import { test } from "node:test"
import assert from "node:assert/strict"
import { formatAnswer, recordAnswered } from "./answered-questions.ts"

const request = { id: "form-1", questions: [{ header: "Stack", question: "Which stack?" }] }

test("an answered question is kept with its answers", () => {
  const list = recordAnswered([], request, [["Expo"]])
  assert.equal(list.length, 1)
  assert.equal(list[0].request.id, "form-1")
  assert.deepEqual(list[0].answers, [["Expo"]])
})

test("answering the same request again replaces the entry instead of duplicating it", () => {
  const first = recordAnswered([], request, [["Expo"]])
  const second = recordAnswered(first, request, [["Bare RN"]])
  assert.equal(second.length, 1)
  assert.deepEqual(second[0].answers, [["Bare RN"]])
})

test("answers are copied, so later edits to the caller's array cannot rewrite history", () => {
  const answers = [["Expo"]]
  const list = recordAnswered([], request, answers)
  answers[0].push("Bare RN")
  assert.deepEqual(list[0].answers, [["Expo"]])
})

test("multiple answered questions keep their order", () => {
  const list = recordAnswered(
    recordAnswered([], request, [["Expo"]]),
    { id: "form-2", questions: [{ header: "Lint", question: "Linter?" }] },
    [["ESLint"]],
  )
  assert.deepEqual(
    list.map((item) => item.request.id),
    ["form-1", "form-2"],
  )
})

test("formatAnswer joins multi-question answers into one readable line", () => {
  assert.equal(formatAnswer([["Expo"], ["ESLint", "Prettier"], ["  "]]), "Expo · ESLint · Prettier")
})
