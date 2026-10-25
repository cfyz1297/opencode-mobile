import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import { isStreamStalled } from "./stream-watchdog.ts"
import { isSessionActuallyIdle } from "./session-status-reconcile.ts"
import { runsNeedingResync } from "./run-watchdog.ts"

const require = createRequire(import.meta.url)
const ts = require("typescript")

const SESSION = "ses_1"
const COMPLETED_TRANSCRIPT = [
  { info: { id: "u1", sessionID: SESSION, role: "user", time: { created: 1 } }, parts: [] },
  { info: { id: "a1", sessionID: SESSION, role: "assistant", time: { created: 2, completed: 9 } }, parts: [] },
]

/**
 * Run the real events store with a real SSE loop shape and fake time.
 * The stream stays open and keeps sending heartbeats (so `isStreamStalled`
 * never fires), which is exactly the reported failure: the socket is fine,
 * the session's events are not.
 */
function harness() {
  let now = 1_000_000
  let nextTimerID = 1
  const timers: Array<{ id: number; fn: () => void; due: number; period?: number; active: boolean }> = []

  const schedule = (fn: () => void, ms: number, period?: number) => {
    const id = nextTimerID++
    timers.push({ id, fn, due: now + ms, period, active: true })
    return id
  }

  // Controllable SSE source: `push()` delivers one event, `heartbeat()` wakes
  // the sdk's onActivity callback without ever yielding an event.
  let pending: ((value: { done: boolean; value?: unknown }) => void) | null = null
  const queue: unknown[] = []
  const sse = {
    push(event: unknown) {
      if (pending) {
        const resolve = pending
        pending = null
        resolve({ done: false, value: event })
      } else queue.push(event)
    },
    next(): Promise<{ done: boolean; value?: unknown }> {
      if (queue.length) return Promise.resolve({ done: false, value: queue.shift() })
      return new Promise((resolve) => {
        pending = resolve
      })
    },
  }

  const stats = { messageCalls: 0, pendingCalls: 0, refreshCalls: 0, handled: [] as string[] }
  let onActivity: (() => void) | null = null

  const client = {
    session: {
      messages: async () => {
        stats.messageCalls++
        return COMPLETED_TRANSCRIPT
      },
    },
    permission: {
      list: async () => {
        stats.pendingCalls++
        return []
      },
    },
    question: {
      list: async () => {
        stats.pendingCalls++
        return []
      },
    },
    global: {
      events: async function* (signal: AbortSignal, activity?: () => void) {
        onActivity = activity ?? null
        while (!signal.aborted) {
          const item = await sse.next()
          if (item.done) return
          onActivity?.()
          if (item.value) yield item.value
        }
      },
    },
  }

  const makeStore = <T,>(initializer: (set: any, get: any, api: any) => T) => {
    let state: T
    const listeners = new Set<(s: T) => void>()
    const setState = (partial: any, replace = false) => {
      const next = typeof partial === "function" ? partial(state) : partial
      state = replace ? next : { ...(state as object), ...next } as T
      for (const listener of listeners) listener(state)
    }
    const getState = () => state
    const api = { setState, getState, subscribe: (l: (s: T) => void) => (listeners.add(l), () => listeners.delete(l)) }
    state = initializer(setState, getState, api)
    return Object.assign(() => state, api)
  }

  const sessions = makeStore<any>(() => ({
    sessions: [],
    currentSession: { id: SESSION, title: "incident" },
    messages: [],
    parts: {},
    sending: {},
    refreshMessages: async () => {
      stats.refreshCalls++
    },
    handleEvent: (event: { type: string }) => {
      stats.handled.push(event.type)
    },
  }))

  const modules: Record<string, unknown> = {
    zustand: { create: makeStore },
    "./connections": {
      useConnections: {
        getState: () => ({ client, clientForDirectory: () => client, activeConnection: { id: "conn" } }),
        subscribe: () => () => {},
      },
    },
    "./sessions": { useSessions: sessions, abortedSessions: new Set<string>() },
    "../lib/notifications": { send: () => {} },
    "../lib/notify-format": { sanitizeBody: (_title: unknown, fallback: string) => fallback },
    "../lib/status-labels": { statusFromPart: () => "" },
    "../lib/store-review": { recordSuccessfulSession: async () => {} },
    "../lib/api-error": { isAuthError: () => false },
    "../lib/session-status-reconcile": { isSessionActuallyIdle },
    "../lib/stream-watchdog": { isStreamStalled },
    "../lib/run-watchdog": { runsNeedingResync },
    "../lib/pending-questions": { reconcilePendingQuestions: (local: unknown) => local },
  }

  const source = readFileSync(new URL("../stores/events.ts", import.meta.url), "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText

  const exports: Record<string, any> = {}
  runInNewContext(output, {
    exports,
    module: { exports },
    require: (id: string) => {
      if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`)
      return modules[id]
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    AbortController,
    Date: { now: () => now },
    Math,
    Promise,
    Object,
    Array,
    Set,
    Map,
    JSON,
    String,
    Boolean,
    Number,
    Error,
    setTimeout: (fn: () => void, ms: number) => schedule(fn, ms),
    clearTimeout: (id: number) => {
      const timer = timers.find((t) => t.id === id)
      if (timer) timer.active = false
    },
    setInterval: (fn: () => void, ms: number) => schedule(fn, ms, ms),
    clearInterval: (id: number) => {
      const timer = timers.find((t) => t.id === id)
      if (timer) timer.active = false
    },
  })

  const settle = async () => {
    for (let i = 0; i < 30; i++) await new Promise((resolve) => setImmediate(resolve))
  }

  // Heartbeats are scheduled on absolute time so advancing in small steps
  // still produces them at a fixed cadence (a per-call cadence would reset the
  // clock every step and never fire).
  let heartbeatEvery = 0
  let nextHeartbeat = Infinity

  const advance = async (ms: number) => {
    const target = now + ms
    while (now < target) {
      now = Math.min(now + 1000, target)
      for (const timer of [...timers]) {
        if (!timer.active || timer.due > now) continue
        if (timer.period) timer.due += timer.period
        else timer.active = false
        timer.fn()
      }
      if (now >= nextHeartbeat) {
        nextHeartbeat += heartbeatEvery
        onActivity?.()
      }
      await settle()
    }
  }

  return {
    events: exports.useEvents,
    sessions,
    stats,
    connect: () => exports.useEvents.getState().connect(),
    push: (event: unknown) => {
      sse.push(event)
      return settle()
    },
    advance,
    settle,
    heartbeatEvery(ms: number) {
      heartbeatEvery = ms
      nextHeartbeat = now + ms
    },
    setBusy: () => {
      sessions.setState({ sending: { [SESSION]: true } })
    },
    now: () => now,
  }
}

const busyEvent = {
  type: "session.status",
  properties: { sessionID: SESSION, status: { type: "busy" } },
}

test("a run whose events are lost still shows the answer without reopening the session", async () => {
  const app = harness()
  app.heartbeatEvery(15_000)
  app.setBusy()
  app.connect()
  await app.settle()
  await app.push(busyEvent)
  assert.equal(app.events.getState().sessionStatus[SESSION].type, "busy")

  // 45s of a healthy socket (heartbeats) with zero events for this session.
  await app.advance(45_000)

  assert.equal(app.events.getState().connected, true, "socket stayed up — the stream watchdog cannot help")
  assert.ok(app.stats.messageCalls > 0, "the run watchdog must fetch the transcript itself")
  assert.equal(app.events.getState().sessionStatus[SESSION].type, "idle")
  assert.equal(app.sessions.getState().sending[SESSION], false)
  assert.ok(app.stats.refreshCalls > 0, "the visible transcript is refreshed, not just the spinner")
})

test("a run that keeps emitting events is never re-fetched", async () => {
  const app = harness()
  app.heartbeatEvery(15_000)
  app.setBusy()
  app.connect()
  await app.settle()
  await app.push(busyEvent)

  for (let i = 0; i < 9; i++) {
    await app.advance(5_000)
    await app.push({
      type: "message.part.updated",
      properties: { part: { id: "a1_text0", sessionID: SESSION, messageID: "a1", type: "text", text: "…" } },
    })
  }

  assert.equal(app.stats.messageCalls, 0)
  assert.equal(app.events.getState().sessionStatus[SESSION].type, "busy")
})

test("a long silent run is re-checked, not hammered every tick", async () => {
  const app = harness()
  app.heartbeatEvery(15_000)
  app.setBusy()
  app.connect()
  await app.settle()
  await app.push(busyEvent)

  await app.advance(120_000)

  assert.ok(app.stats.messageCalls >= 1, "expected at least one resync")
  assert.ok(app.stats.messageCalls <= 10, `expected rate-limited resyncs, saw ${app.stats.messageCalls}`)
})

test("an idle session is never re-fetched", async () => {
  const app = harness()
  app.heartbeatEvery(15_000)
  app.connect()
  await app.settle()
  await app.advance(120_000)

  assert.equal(app.stats.messageCalls, 0)
})

test("a completed run stops the watchdog so it cannot resurrect the spinner", async () => {
  const app = harness()
  app.heartbeatEvery(15_000)
  app.setBusy()
  app.connect()
  await app.settle()
  await app.push(busyEvent)
  await app.advance(20_000)

  const callsAfterIdle = app.stats.messageCalls
  await app.advance(60_000)
  assert.equal(app.stats.messageCalls, callsAfterIdle, "no further transcript fetches once the run is over")
})
