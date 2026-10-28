import { test } from "node:test"
import assert from "node:assert/strict"
import { keyboardPadding } from "./keyboard-inset.ts"

// Regression: on edge-to-edge Android the old screenY-based guess produced the
// nav-bar inset (~24dp) instead of the keyboard height, so the composer stayed
// behind the keyboard. The padding must come from the reported IME inset.
test("edge-to-edge: the system bar inset is added back to the reported height", () => {
  assert.equal(keyboardPadding(252, 24), 276)
  assert.equal(keyboardPadding(300, 48), 348)
})

test("no system bar inset (iOS, or a window that already avoids the keyboard)", () => {
  assert.equal(keyboardPadding(300, 0), 300)
  assert.equal(keyboardPadding(300, -5), 300)
})

test("a hidden keyboard needs no padding", () => {
  assert.equal(keyboardPadding(0, 24), 0)
  assert.equal(keyboardPadding(Number.NaN, 24), 0)
})
