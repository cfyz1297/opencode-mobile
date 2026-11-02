// The chat list used to be rebuilt once per streamed token. Events are now
// coalesced upstream (events.ts), so this pins the store half of the contract:
// a whole batch is one notification, parts keep their arrival order, a later
// delta replaces the earlier copy, and other sessions' parts are ignored.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { createStore } from "zustand/vanilla"
import { mergeIncomingMessage, reconcileTemps } from "./message-merge.ts"
import { isColdSessionLoad, isLiveEventForSession } from "./session-load-reconcile.ts"

const SESSION = "ses_1"

function harness() {
  const connections = createStore(() => ({ activeConnection: { id: "a", url: "https://a.example" }, client: null }))
  const source = fs.readFileSync(new URL("../stores/sessions.ts", import.meta.url), "utf8")
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports: Record<string, any> = {}
  const deps: Record<string, unknown> = {
    zustand: { create: createStore },
    "../lib/sdk": { ApiError: Error },
    "./connections": { useConnections: connections },
    "./settings": { useSettings: { getState: () => ({ pageSize: 25 }) } },
    "../lib/prompt-from-parts": { extractPromptFromParts: () => ({ text: "" }) },
    "../lib/message-merge": { mergeIncomingMessage, reconcileTemps },
    "../lib/session-load-reconcile": { isColdSessionLoad, isLiveEventForSession },
    "../lib/history-storage": { offlineHistory: { remove: async () => {} } },
  }
  vm.runInNewContext(code, {
    exports,
    require: (name: string) => {
      assert.ok(name in deps, `unexpected dependency ${name}`)
      return deps[name]
    },
    console,
    setTimeout,
    clearTimeout,
  })

  const store = exports.useSessions
  store.setState({
    currentSession: { id: SESSION, title: "t", directory: "/project", time: { updated: 1 } },
    messages: [{ id: "u1", sessionID: SESSION, role: "user", time: { created: 1 } }],
    parts: { u1: [] },
    isLoading: true,
  })
  let notifies = 0
  store.subscribe(() => notifies++)
  return { store, notifies: () => notifies, reset: () => (notifies = 0) }
}

const textPart = (id: string, text: string, sessionID = SESSION) => ({
  id,
  messageID: "a1",
  sessionID,
  type: "text",
  text,
})

test("a batch of deltas is a single store write", () => {
  const h = harness()
  h.reset()
  h.store.getState().applyStreamBatch(
    [{ id: "a1", sessionID: SESSION, role: "assistant", time: { created: 2 } }],
    [textPart("p1", "Hello"), textPart("p2", "world"), textPart("p1", "Hello!")],
  )
  assert.equal(h.notifies(), 1, "three deltas must not notify three times")
})

test("parts keep arrival order and the newest copy of a part wins", () => {
  const h = harness()
  h.store.getState().applyStreamBatch([], [textPart("p1", "a"), textPart("p2", "b"), textPart("p1", "a2")])
  const parts = h.store.getState().parts.a1
  assert.deepEqual(Array.from(parts, (p: { id: string }) => p.id), ["p1", "p2"])
  assert.equal(parts[0].text, "a2", "the last delta for a part replaces the earlier one")
})

test("a live message.updated replaces the placeholder in the same write", () => {
  const h = harness()
  h.store.getState().applyStreamBatch(
    [{ id: "a1", sessionID: SESSION, role: "assistant", time: { created: 2 } }],
    [textPart("p1", "answer")],
  )
  const state = h.store.getState()
  assert.deepEqual(Array.from(state.messages, (m: { id: string }) => m.id), ["u1", "a1"])
  assert.equal(state.isLoading, false, "live output proves there is content to show")
  assert.equal(state.parts.a1.length, 1)
})

test("deltas for another session never touch the open one", () => {
  const h = harness()
  h.reset()
  const before = h.store.getState().parts
  h.store.getState().applyStreamBatch([], [textPart("p9", "other", "ses_2")])
  assert.equal(h.store.getState().parts, before, "no write for a foreign session")
  assert.equal(h.notifies(), 0)
})

test("an empty batch is a no-op", () => {
  const h = harness()
  h.reset()
  h.store.getState().applyStreamBatch([], [])
  assert.equal(h.notifies(), 0)
})

test("a batch with no open session is dropped", () => {
  const h = harness()
  h.store.setState({ currentSession: null })
  h.reset()
  h.store.getState().applyStreamBatch([], [textPart("p1", "x")])
  assert.equal(h.notifies(), 0)
  assert.equal(h.store.getState().parts.a1, undefined)
})
