// Reported from the device: with the keyboard open the reasoning-effort picker
// rendered behind the IME and its last row ("High") could not be tapped. The
// sheet is a native view under node:test, so the fix is pinned in the sources.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const read = (p: string) => readFileSync(path.join(root, p), "utf8")

test("the variant sheet moves with the keyboard like its siblings", () => {
  const sheet = read("src/components/chat/VariantPicker.tsx")
  assert.match(sheet, /keyboardBehavior="interactive"/)
  assert.match(sheet, /android_keyboardInputMode="adjustResize"/)
})

test("opening the variant picker dismisses the keyboard first", () => {
  const screen = read("app/session/[id].tsx")
  const chip = screen.slice(screen.indexOf('testID="variant-chip"') - 400, screen.indexOf('testID="variant-chip"'))
  assert.match(chip, /Keyboard\.dismiss\(\)/, "the picker has no input, so the IME is only obstruction")
})
