// ToolCallCard can't be rendered under node:test (react-native components),
// so the wiring from the tested helpers into the row is pinned in its source.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const card = readFileSync(path.join(root, "src/components/chat/ToolCallCard.tsx"), "utf8")

test("a shell tool renders the terminal icon and the command block", () => {
  assert.match(card, /shell: "terminal-outline"/)
  assert.match(card, /case "bash":\s*\n\s*case "shell":/, "shell uses the bash renderer")
})

test("the row header and detail come from the shared helpers", () => {
  // A local re-implementation is how `shell` and the empty-output case were
  // missed in the first place.
  assert.match(card, /const title = toolTitle\(/)
  assert.match(card, /const text = toolDetailText\(/)
  assert.match(card, /isShellTool\(tool\.tool\) && !!toolCommand\(/)
})
