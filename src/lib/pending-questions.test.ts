// Pending-question reconciliation — the server is authoritative for which
// forms are still open. Pins the recovery path for questions created while the
// app was backgrounded/disconnected and for forms answered from another client
// (e.g. the terminal) while the app kept a stale local copy.
import { test } from "node:test"
import assert from "node:assert/strict"
import { reconcilePendingQuestions } from "./pending-questions.ts"

test("reconcilePendingQuestions adopts a question created during an SSE outage", () => {
  const server = [{ id: "frm_new", sessionID: "ses_1" }]
  assert.deepEqual(reconcilePendingQuestions([], server), server)
})

test("reconcilePendingQuestions drops a question no longer pending on the server", () => {
  const cached = [
    { id: "frm_stale", sessionID: "ses_1" },
    { id: "frm_open", sessionID: "ses_1" },
  ]
  const server = [{ id: "frm_open", sessionID: "ses_1" }]
  assert.deepEqual(reconcilePendingQuestions(cached, server), server)
})

test("reconcilePendingQuestions clears the cache when the server has no pending forms", () => {
  assert.deepEqual(reconcilePendingQuestions([{ id: "frm_stale", sessionID: "ses_1" }], []), [])
})

test("reconcilePendingQuestions returns a copy instead of the caller's array", () => {
  const server = [{ id: "frm_1", sessionID: "ses_1" }]
  const result = reconcilePendingQuestions([], server)
  assert.notEqual(result, server)
  assert.deepEqual(result, server)
})
