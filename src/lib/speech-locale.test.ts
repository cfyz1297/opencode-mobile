import { test } from "node:test"
import assert from "node:assert/strict"
import { speechLocale } from "./speech-locale.ts"

test("device locale is passed to the recognizer unchanged", () => {
  assert.equal(speechLocale("ru-RU"), "ru-RU")
  assert.equal(speechLocale("zh-CN"), "zh-CN")
  assert.equal(speechLocale("en-GB"), "en-GB")
})

test("missing locale falls back to en-US", () => {
  assert.equal(speechLocale(undefined), "en-US")
  assert.equal(speechLocale(""), "en-US")
})
