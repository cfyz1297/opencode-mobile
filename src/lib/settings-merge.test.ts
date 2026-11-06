import { test } from "node:test"
import assert from "node:assert/strict"
import { mergeStoredSettings } from "./settings-merge.ts"

const DEFAULTS = {
  pageSize: 10,
  notifications: { idle: true, error: true, permission: false },
}


test("empty stored settings yield the defaults", () => {
  assert.deepEqual(mergeStoredSettings(DEFAULTS, {}), DEFAULTS)
})

test("stored values override defaults", () => {
  const merged = mergeStoredSettings(DEFAULTS, { pageSize: 50 })
  assert.equal(merged.pageSize, 50)
  assert.deepEqual(merged.notifications, DEFAULTS.notifications)
})

test("upgrade path: a category missing from storage gets its default", () => {
  // Stored data predates the "permission" category — it must come back as the default (false),
  // not undefined, while the user's stored choices are preserved.
  const merged = mergeStoredSettings(DEFAULTS, { notifications: { idle: false, error: true } } as Partial<typeof DEFAULTS>)
  assert.equal(merged.notifications.idle, false) // user's stored choice kept
  assert.equal(merged.notifications.error, true)
  assert.equal(merged.notifications.permission, false) // new category -> default
  assert.equal("permission" in merged.notifications, true)
})

test("does not mutate the inputs", () => {
  const defaults = { pageSize: 25, notifications: { a: true } }
  const parsed = { notifications: { a: false } }
  const merged = mergeStoredSettings(defaults, parsed)
  assert.equal(defaults.notifications.a, true) // untouched
  assert.equal(parsed.notifications.a, false) // untouched
  assert.equal(merged.notifications.a, false)
  assert.notEqual(merged.notifications, defaults.notifications)
})
