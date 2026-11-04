import { test } from "node:test"
import assert from "node:assert/strict"
import { isShellTool, toolCommand, toolDetailText, toolTitle } from "./tool-view.ts"

test("the 2.x `shell` tool is treated as a terminal command", () => {
  // Upstream servers name it `shell`; only `bash` used to match, so the row
  // showed the bare name and no command at all (reported from the device).
  assert.equal(isShellTool("shell"), true)
  assert.equal(isShellTool("bash"), true)
  assert.equal(isShellTool("read"), false)
  assert.equal(toolCommand({ command: "npm test" }), "npm test")
  assert.equal(toolCommand({ command: "" }), undefined)
  assert.equal(toolCommand("npm test"), undefined)
})

test("the header prefers the command, then the server's progress title, then the name", () => {
  assert.equal(toolTitle({ tool: "shell", state: { input: { command: "ls -la" } } }, "Tool"), "ls -la")
  // session.tool.progress says what a long run is doing in metadata.title.
  assert.equal(toolTitle({ tool: "shell", state: { input: {}, title: "Running tests" } }, "Tool"), "Running tests")
  assert.equal(toolTitle({ tool: "read", state: { input: { filePath: "/a" } } }, "Tool"), "read")
  assert.equal(toolTitle({}, "Tool"), "Tool")
})

test("an empty output string does not hide the tool input", () => {
  // session.tool.success sends "" for a tool that produced no text; the
  // expanded card rendered nothing while the input was right there.
  assert.equal(toolDetailText({ command: "ls" }, ""), JSON.stringify({ command: "ls" }, null, 2))
  assert.equal(toolDetailText({ command: "ls" }, "out"), "out")
  assert.equal(toolDetailText({ command: "ls" }, undefined), JSON.stringify({ command: "ls" }, null, 2))
})

test("a started-but-empty tool has no detail, so no dead chevron", () => {
  assert.equal(toolDetailText({}, undefined), undefined)
  assert.equal(toolDetailText(undefined, undefined), undefined)
  assert.equal(toolDetailText({}, ""), undefined)
  assert.equal(toolDetailText(undefined, []), undefined)
})

test("string payloads are shown as-is and unserialisable input cannot throw", () => {
  assert.equal(toolDetailText("raw", undefined), "raw")
  const circular: Record<string, unknown> = {}
  circular.self = circular
  assert.equal(toolDetailText(circular, undefined), undefined)
})
