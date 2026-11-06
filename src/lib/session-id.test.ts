import { test } from "node:test"
import assert from "node:assert/strict"
import { isSafeSessionId } from "./session-id.ts"

test("opencode session ids are accepted", () => {
  assert.equal(isSafeSessionId("ses_abc123"), true)
  assert.equal(isSafeSessionId("01J8Z9K4Q7"), true)
  assert.equal(isSafeSessionId("a-b_c"), true)
})

test("path traversal and encoded separators are rejected", () => {
  for (const value of ["", "..", "../config", "a/b", "a%2Fb", "a?b", "a#b", "a b", "a.b", 42, null]) {
    assert.equal(isSafeSessionId(value), false, String(value))
  }
  assert.equal(isSafeSessionId("a".repeat(201)), false)
})
