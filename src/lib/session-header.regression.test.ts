// The session screen re-renders on every streamed part. Inline <Stack.Screen
// options> re-registers the native header on each render; leaving the screen
// mid-stream then races that update with the teardown (react-native-screens
// "child already has a parent", upstream v0.4.17 / OPENCODE-MOBILE-6/-7). The
// header cannot be rendered under node:test, so the wiring is pinned here.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const screen = readFileSync(path.join(root, "app/session/[id].tsx"), "utf8")

test("the session header is applied imperatively, never inline", () => {
  assert.doesNotMatch(
    screen,
    /<Stack\.Screen/,
    "inline options re-register the native header on every streamed part",
  )
  assert.match(screen, /useNavigation\(\)/, "options go through the navigation object")
  assert.match(screen, /navigation\.setOptions\(\{/, "header options are applied in an effect")
})

test("the header effect keeps the title and the context ring", () => {
  const start = screen.indexOf("navigation.setOptions")
  const effect = screen.slice(start, screen.indexOf("}, [navigation", start))
  assert.match(effect, /title: currentSession\?\.title/, "title still follows the session")
  assert.match(effect, /headerRight:/, "the folder badge and ring stay in the header")
  assert.match(effect, /<ContextRing[\s\S]{0,200}percent=\{contextPercent\}/)
})

test("the header effect depends on every value it renders", () => {
  // A missing dep freezes the header until some other value changes; a dep on
  // streaming messages would recreate the original crash.
  const deps = screen.match(/\}, \[navigation[^\]]*\]\)/)
  assert.ok(deps, "the effect keeps an explicit dependency list")
  for (const dep of ["currentSession?.title", "shortDir", "showInfo", "isDark", "t", "contextPercent"]) {
    assert.ok(deps[0].includes(dep), `missing dependency: ${dep}`)
  }
  assert.doesNotMatch(deps[0], /\bmessages\b|\bparts\b/, "streamed content must not re-register the header")
})
