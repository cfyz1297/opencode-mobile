// Android dialogs and the system BACK gesture.
//
// React Native's Alert.alert defaults to `cancelable: false` on Android
// (Libraries/Alert/Alert.js sets it explicitly), and a non-cancelable
// AlertDialog also swallows BACK — so the session action sheet could only be
// closed by tapping one of its buttons. Every action dialog here has a
// "Cancel" button; each one must also pass `{ cancelable: true }`.
//
// The runtime can't be rendered under node:test (same constraint as
// wide-content-scroll.regression.test.ts), so this pins the source instead:
// one `cancelable: true` per dialog that offers a cancel button.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8")
}

function count(src: string, pattern: RegExp): number {
  return (src.match(pattern) ?? []).length
}

for (const screen of ["app/(tabs)/index.tsx", "app/session/[id].tsx"]) {
  test(`${screen}: every action dialog can be closed with the BACK gesture`, () => {
    const src = read(screen)
    const actionDialogs = count(src, /style:\s*"cancel"/g)
    const dismissable = count(src, /cancelable:\s*true/g)
    assert.ok(actionDialogs > 0, "expected at least one action dialog in this screen")
    assert.equal(
      dismissable,
      actionDialogs,
      "each Alert.alert with a Cancel button needs { cancelable: true } (RN defaults to false on Android)",
    )
  })
}
