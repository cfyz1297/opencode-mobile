import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { keyboardPadding } from "./keyboard-inset.ts"

// Regression: the composer sat behind the keyboard on every Android build.
// React Native's keyboardDidShow never fires in this app (bridgeless root view
// has no ReactInstanceManager, so RN's global-layout listener returns early),
// and edge-to-edge means the window never resizes for the IME either. The
// padding now comes from the native `imeInset` event instead.

test("the native IME inset becomes the padding", () => {
  assert.equal(keyboardPadding({ height: 276, visible: true }), 276)
  assert.equal(keyboardPadding({ height: 312.5, visible: true }), 312.5)
})

test("a hidden keyboard means no padding, even if a stale height lingers", () => {
  assert.equal(keyboardPadding({ height: 0, visible: false }), 0)
  assert.equal(keyboardPadding({ height: 276, visible: false }), 0)
  assert.equal(keyboardPadding({ height: 0 }), 0)
})

test("the React Native event shape still works (iOS path)", () => {
  assert.equal(keyboardPadding({ endCoordinates: { height: 300 } }), 300)
  assert.equal(keyboardPadding({ endCoordinates: { height: 0 } }), 0)
  assert.equal(keyboardPadding({}), 0)
})

test("garbage values never produce a negative or non-finite padding", () => {
  assert.equal(keyboardPadding({ height: Number.NaN }), 0)
  assert.equal(keyboardPadding({ height: -40 }), 0)
  assert.equal(keyboardPadding({ height: Number.POSITIVE_INFINITY }), 0)
})

// The event only exists because of a hand-written native listener in a
// prebuild-generated project: `expo prebuild --clean` or a careless
// regeneration silently drops it, and the bug returns with no failing test
// anywhere else. Pin both ends of the contract.
test("MainActivity shrinks the root view under the IME and emits imeInset", () => {
  const root = path.join(import.meta.dirname, "..", "..")
  const activity = fs.readFileSync(
    path.join(root, "android/app/src/main/java/cc/agentlabs/opencode/MainActivity.kt"),
    "utf8",
  )
  const hook = fs.readFileSync(path.join(root, "src/lib/use-keyboard-height.ts"), "utf8")

  assert.match(activity, /WindowInsetsCompat\.Type\.ime\(\)/)
  assert.match(activity, /updatePadding\(bottom = imeBottom\)/)
  assert.match(activity, /emitDeviceEvent\("imeInset"/)
  assert.match(activity, /putDouble\("height"/)
  assert.match(hook, /addListener\("imeInset"/)
})

// Screens must not pad themselves by the keyboard height: the root view is
// already shrunk, so a second offset only shortens the scroll area and leaves
// the bottom of the screen — the composer included — under the keyboard.
test("full-screen layouts do not add their own keyboard padding", () => {
  const root = path.join(import.meta.dirname, "..", "..")
  for (const file of [
    "app/session/[id].tsx",
    "app/connection/add.tsx",
    "app/connection/[id].tsx",
    "app/connection/tunnel.tsx",
  ]) {
    const source = fs.readFileSync(path.join(root, file), "utf8")
    assert.doesNotMatch(source, /paddingBottom:\s*kb(Height)?\b/, `${file} double-pads for the keyboard`)
  }
})
