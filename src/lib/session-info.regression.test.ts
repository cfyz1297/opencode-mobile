// The session-info header and panel can't be rendered under node:test, so the
// wiring is pinned in the sources.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const read = (p: string) => readFileSync(path.join(root, p), "utf8")

test("the session-info control is a ring filled by context usage", () => {
  const screen = read("app/session/[id].tsx")
  assert.match(screen, /<ContextRing[\s\S]{0,200}percent=\{contextPercent\}/)
  // The old static stats-chart icon left the percentage one tap away.
  assert.doesNotMatch(screen, /name=\{showInfo \? "stats-chart" : "stats-chart-outline"\}/)

  const ring = read("src/components/chat/ContextRing.tsx")
  assert.match(ring, /strokeDashoffset=\{CIRCUMFERENCE \* \(1 - filled \/ 100\)\}/, "arc length follows the percentage")
  assert.match(ring, /rotate\(-90/, "the arc starts at 12 o'clock")
})

test("the ring and the panel read the same numbers", () => {
  // Two independent calculations is how the percentage and the ring drift apart.
  assert.match(read("app/session/[id].tsx"), /computeSessionStats\(/)
  assert.match(read("src/components/chat/SessionInfo.tsx"), /computeSessionStats\(messages, providers, session\)/)
})

test("the panel shows total session cost next to the context percentage", () => {
  const panel = read("src/components/chat/SessionInfo.tsx")
  const row = panel.slice(panel.indexOf("<View style={s.costRow}>"), panel.indexOf("onPress={onClose}"))
  assert.ok(row.length > 0, "the top row is where the numbers live")
  assert.match(row, /stats\.percent/, "percentage")
  assert.match(row, /formatCost\(stats\.cost\)/, "and the session cost in the same row")
  assert.doesNotMatch(panel, /barOk|barMid|barWarn/, "bar colour comes from fillColor()")
})
