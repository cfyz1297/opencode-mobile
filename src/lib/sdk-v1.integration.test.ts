// Exercise the v1 client against a real loopback HTTP server. This is the
// transport the app uses for opencode 1.x servers; the stores consume the same
// shapes the v2 client produces, so a wrong path or envelope here is invisible
// to typecheck and only shows up as "server unreachable" on a phone.
import { after, before, beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { registerHooks } from "node:module"

const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "expo/fetch") {
      return { url: "data:text/javascript,export const fetch = (...args) => globalThis.fetch(...args)", shortCircuit: true }
    }
    if (specifier.startsWith("./") && !/\.[a-z]+$/i.test(specifier)) {
      return next(`${specifier}.ts`, context)
    }
    return next(specifier, context)
  },
})
const { createClient, ApiError, isAuthError } = await import("./sdk.ts")
const { normalizeV1Event, mapV1Permission } = await import("./sdk-v1.ts")

type Call = { path: string; method: string; headers: import("node:http").IncomingHttpHeaders; body: Record<string, unknown> }
let calls: Call[] = []
let routes: Record<string, { status?: number; body?: unknown }> = {}
let experimentalStatus = 200
let nextCursor: number | undefined
let healthStatus = 200
let eventPayload = ""
const session = { id: "s1", slug: "s1", projectID: "p", directory: "/work", title: "S", version: "1.18.34", time: { created: 1, updated: 2 } }

const server = createServer(async (req, res) => {
  let body = ""
  for await (const chunk of req) body += chunk
  calls.push({ path: req.url!, method: req.method!, headers: req.headers, body: body ? JSON.parse(body) : {} })

  if (req.url === "/global/event") {
    res.writeHead(200, { "Content-Type": "text/event-stream" })
    res.end(eventPayload)
    return
  }
  if (req.url?.startsWith("/experimental/session")) {
    if (experimentalStatus !== 200) {
      res.writeHead(experimentalStatus, { "Content-Type": "text/plain" })
      res.end("no")
      return
    }
    if (nextCursor != null) res.setHeader("x-next-cursor", String(nextCursor))
  }
  if (req.url === "/global/health" && healthStatus !== 200) {
    res.writeHead(healthStatus, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "unauthorized" }))
    return
  }
  const route = routes[req.url!]
  const status = route?.status ?? 200
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(status === 204 ? undefined : JSON.stringify(route?.body ?? {}))
})
let base: string
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  hook.deregister()
})
beforeEach(() => {
  calls = []
  routes = {}
  experimentalStatus = 200
  nextCursor = undefined
  healthStatus = 200
  eventPayload = ""
})

const client = (extra: Record<string, unknown> = {}) =>
  createClient({ baseUrl: `${base}///`, auth: { username: "имя", password: "пароль" }, directory: "/проект", api: "v1", ...extra })

test("v1 health, auth, directory header and URL normalization", async () => {
  routes["/global/health"] = { body: { healthy: true, version: "1.18.34" } }
  assert.deepEqual(await client().global.health(), { healthy: true, version: "1.18.34" })
  assert.equal(calls[0].path, "/global/health")
  assert.equal(calls[0].headers.authorization, `Basic ${Buffer.from("имя:пароль").toString("base64")}`)
  assert.equal(calls[0].headers["x-opencode-directory"], encodeURIComponent("/проект"))
})

test("a 401 is surfaced as an auth error, a 503 as a plain API error", async () => {
  healthStatus = 401
  await assert.rejects(client().global.health(), (error: unknown) => isAuthError(error))
  healthStatus = 200
  routes["/global/health"] = { status: 503, body: { error: "down" } }
  await assert.rejects(client().global.health(), (error: unknown) => error instanceof ApiError && error.status === 503)
})

test("session list prefers /experimental/session and shapes client-side", async () => {
  routes["/experimental/session?limit=200"] = {
    body: [
      { ...session, id: "old", parentID: "parent", time: { created: 1, updated: 1 } },
      { ...session, id: "new", time: { created: 2, updated: 9 } },
      { ...session, id: "mid", time: { created: 3, updated: 5 } },
    ],
  }
  const list = await client().session.list({ roots: true, limit: 2 })
  assert.deepEqual(list.map((s) => s.id), ["new", "mid"])
  assert.equal(calls[0].path, "/experimental/session?limit=200")
})

test("session list follows x-next-cursor instead of trusting the newest page", async () => {
  // The route defaults to 100 rows and silently truncates; without the cursor
  // every older session is missing from the app while the TUI still lists it.
  routes["/experimental/session?limit=200"] = {
    body: [{ ...session, id: "new", time: { created: 2, updated: 9 } }],
  }
  routes["/experimental/session?limit=200&cursor=42"] = {
    body: [{ ...session, id: "old", time: { created: 1, updated: 1 } }],
  }
  nextCursor = 42
  const list = await client().session.list({ roots: true })
  assert.deepEqual(list.map((s) => s.id), ["new", "old"])
  assert.deepEqual(calls.map((c) => c.path), [
    "/experimental/session?limit=200",
    "/experimental/session?limit=200&cursor=42",
  ])
})

test("a repeated cursor ends the walk instead of looping on a server that ignores it", async () => {
  routes["/experimental/session?limit=200"] = {
    body: [{ ...session, id: "new", time: { created: 2, updated: 2 } }],
  }
  routes["/experimental/session?limit=200&cursor=7"] = routes["/experimental/session?limit=200"]
  nextCursor = 7
  await client().session.list()
  // One page with the cursor, then the same cursor comes back: stop rather
  // than request page 3, 4, ... forever. Rows are deduped too.
  assert.equal(calls.filter((c) => c.path.startsWith("/experimental/session")).length, 2)
})

test("session list falls back to the legacy route when the experimental one is absent", async () => {
  experimentalStatus = 404
  routes[`/session?roots=true&limit=5`] = { body: [session] }
  assert.deepEqual((await client().session.list({ roots: true, limit: 5 })).map((s) => s.id), ["s1"])
  assert.ok(!calls.some((c) => c.path === "/experimental/session" && c.method !== "GET"))
  assert.equal(calls[1].path, "/session?roots=true&limit=5")
})

test("session CRUD and messages use the v1 routes", async () => {
  routes["/session/s1"] = { body: session }
  assert.equal((await client().session.get("s1")).id, "s1")

  routes["/session"] = { body: session }
  await client().session.create({ title: "new" })
  assert.deepEqual(calls.at(-1)!.body, { title: "new" })

  await client().session.update("s1", { title: "renamed", time: { archived: 5 } })
  assert.equal(calls.at(-1)!.method, "PATCH")
  assert.deepEqual(calls.at(-1)!.body, { title: "renamed", time: { archived: 5 } })

  routes["/session/s1/message?limit=2"] = { body: [{ info: { id: "m1" }, parts: [] }] }
  assert.equal((await client().session.messages("s1", { limit: 2 }))[0].info.id, "m1")

  routes["/session/s1"] = { status: 204 }
  assert.equal(await client().session.delete("s1"), undefined)
})

test("v1 whole-session fetch asks for the maximum page in one request", async () => {
  // v1 has no message cursor: the transcript comes back whole, capped only by
  // the route's limit.
  routes["/session/s1/message?limit=200"] = { body: [{ info: { id: "m1" }, parts: [] }] }
  const all = await client().session.allMessages("s1")
  assert.equal(all.length, 1)
  assert.equal(calls[0].path, "/session/s1/message?limit=200")
})

test("v1 has no activity endpoint and reports it as missing", async () => {
  await assert.rejects(client().session.active(), (error: unknown) => error instanceof ApiError && error.status === 404)
})

test("prompt carries model, agent and variant in the body instead of switch calls", async () => {
  routes["/session/s1/prompt_async"] = { status: 204 }
  await client().session.prompt("s1", {
    parts: [{ type: "text", text: "hi" }],
    model: { providerID: "test", modelID: "model-1" },
    agent: "build",
    variant: "high",
  })
  const prompt = calls.find((c) => c.path === "/session/s1/prompt_async")!
  assert.deepEqual(prompt.body, {
    parts: [{ type: "text", text: "hi" }],
    model: { providerID: "test", modelID: "model-1" },
    agent: "build",
    variant: "high",
  })
  assert.ok(!calls.some((c) => /\/model$|\/agent$/.test(c.path)), "v1 has no per-session switch endpoints")
})

test("command, abort, summarize, diff, revert and unrevert use v1 routes", async () => {
  routes["/session/s1/command"] = { status: 204 }
  await client().session.command("s1", { command: "compact", arguments: "" })
  assert.equal((calls.at(-1)!.body as Record<string, unknown>).sessionID, "s1")

  routes["/session/s1/abort"] = { body: true }
  assert.equal(await client().session.abort("s1"), true)

  routes["/session/s1/summarize"] = { body: { id: "sum" } }
  assert.equal(await client().session.compact("s1"), true)

  routes["/session/s1/diff?messageID=m1"] = { body: [] }
  assert.deepEqual(await client().session.diff("s1", "m1"), [])

  routes["/session/s1/revert"] = { body: session }
  assert.equal((await client().session.revert("s1", "m1", "part1")).id, "s1")
  assert.deepEqual(calls.at(-1)!.body, { messageID: "m1", partID: "part1" })

  routes["/session/s1/unrevert"] = { body: session }
  assert.equal((await client().session.unrevert("s1")).id, "s1")
})

test("permissions accept both payload generations and reply without the session in the URL", async () => {
  routes["/permission"] = {
    body: [
      { id: "p1", sessionID: "s1", permission: "bash", patterns: ["rm -rf"], metadata: { a: 1 } },
      { id: "p2", sessionID: "s1", type: "edit", title: "src/a.ts" },
      { id: "", sessionID: "s1" },
    ],
  }
  const list = await client().permission.list()
  assert.deepEqual(list, [
    { id: "p1", sessionID: "s1", permission: "bash", patterns: ["rm -rf"], metadata: { a: 1 }, tool: undefined },
    { id: "p2", sessionID: "s1", permission: "edit", patterns: ["src/a.ts"], metadata: {}, tool: undefined },
  ])

  routes["/permission/p1/reply"] = { body: true }
  await client().permission.reply("s1", "p1", "once")
  assert.deepEqual(calls.at(-1)!.body, { reply: "once" })
})

test("questions are read globally and filtered per session", async () => {
  routes["/question"] = {
    body: [
      { id: "q1", sessionID: "s1", questions: [] },
      { id: "q2", sessionID: "s2", questions: [] },
    ],
  }
  assert.deepEqual((await client().question.list("s1")).map((q: { id: string }) => q.id), ["q1"])

  routes["/question/q1/reply"] = { body: true }
  await client().question.reply("s1", "q1", [["yes"]])
  assert.deepEqual(calls.at(-1)!.body, { answers: [["yes"]] })

  routes["/question/q1/reject"] = { body: true }
  await client().question.reject("s1", "q1")
  assert.equal(calls.at(-1)!.path, "/question/q1/reject")
})

test("catalog, files and paths use the v1 routes", async () => {
  routes["/agent"] = { body: [{ name: "build", mode: "primary", options: {} }] }
  routes["/command"] = { body: [{ name: "compact", template: "", hints: [] }] }
  routes["/provider"] = { body: { all: [], default: {}, connected: [] } }
  routes["/config"] = { body: { model: "test/model-1" } }
  routes["/file?path=."] = { body: [{ name: "a", path: "a", absolute: "/work/a", type: "file", ignored: false }] }
  routes["/file/roots"] = { status: 404, body: {} }
  routes["/path"] = { body: { home: "/home", state: "", config: "", worktree: "/work", directory: "/work" } }
  routes["/project"] = { body: [{ id: "p", path: { cwd: "/work", root: "/work", absolute: "/work" } }] }
  routes["/project/current"] = { body: { id: "p", path: { cwd: "/work", root: "/work", absolute: "/work" } } }

  const c = client()
  assert.equal((await c.agent.list())[0].name, "build")
  assert.equal((await c.command.list())[0].name, "compact")
  assert.deepEqual(await c.provider.list(), { all: [], default: {}, connected: [] })
  assert.deepEqual(await c.config.get(), { model: "test/model-1" })
  assert.equal((await c.file.list())[0].name, "a")
  assert.equal(await c.file.roots(), null)
  assert.equal((await c.path.get()).home, "/home")
  assert.equal((await c.project.list())[0].id, "p")
  assert.equal((await c.project.current())!.id, "p")
})

test("provider keys go to the classic auth route on v1", async () => {
  routes["/auth/opencode"] = { status: 204 }
  assert.deepEqual(await client().provider.connectApiKey("opencode", "secret-key"), { path: "/auth/opencode" })
  assert.equal(calls.at(-1)!.method, "PUT")
  assert.deepEqual(calls.at(-1)!.body, { type: "api", key: "secret-key" })
})

test("the event stream reports activity and rewrites v1-only event names", async () => {
  eventPayload =
    `data: ${JSON.stringify({ type: "session.idle", properties: { sessionID: "s1" } })}\n\n` +
    `data: ${JSON.stringify({ type: "permission.updated", properties: { id: "p9", sessionID: "s1", type: "bash", title: "rm -rf" } })}\n\n` +
    `data: ${JSON.stringify({ type: "message.updated", properties: { info: { id: "m1" } } })}\n\n`
  let activity = 0
  const events = []
  for await (const event of client().global.events(undefined, () => { activity += 1 })) events.push(event)

  assert.deepEqual(events[0], { type: "session.status", properties: { sessionID: "s1", status: { type: "idle" } } })
  assert.deepEqual(events[1], {
    type: "permission.asked",
    properties: { id: "p9", sessionID: "s1", permission: "bash", patterns: ["rm -rf"], metadata: {}, tool: undefined },
  })
  assert.equal(events[2].type, "message.updated")
  assert.ok(activity > 0)
})

test("1.18.x permission.v2 events become the permission prompt the stores know", () => {
  // Upstream #216: a 1.18.x server sends {action, resources} under the v2 event
  // name. Unmapped, the approval prompt never appears and the run hangs.
  assert.deepEqual(
    normalizeV1Event({
      type: "permission.v2.asked",
      properties: { id: "p1", sessionID: "s1", action: "bash", resources: ["rm -rf build"] },
    }),
    {
      type: "permission.asked",
      properties: {
        id: "p1",
        sessionID: "s1",
        permission: "bash",
        patterns: ["rm -rf build"],
        metadata: {},
        tool: undefined,
      },
    },
  )
  assert.deepEqual(
    normalizeV1Event({ type: "permission.v2.replied", properties: { sessionID: "s1", requestID: "p1" } }),
    { type: "permission.replied", properties: { sessionID: "s1", requestID: "p1" } },
  )
  // A malformed payload is passed through untouched rather than fabricating a
  // prompt with no id (the store would render a dead approval card).
  const broken = { type: "permission.v2.asked", properties: { sessionID: "s1" } }
  assert.equal(normalizeV1Event(broken).type, "permission.v2.asked")
})

test("normalizeV1Event leaves already-compatible events untouched", () => {
  const event = { type: "session.status", properties: { sessionID: "s1", status: { type: "busy" } } }
  assert.equal(normalizeV1Event(event), event)
  // A session.idle without an id is not silently turned into a global status.
  assert.equal(normalizeV1Event({ type: "session.idle", properties: {} }).type, "session.idle")
  assert.equal(mapV1Permission(null), null)
  assert.equal(mapV1Permission({ id: "", sessionID: "s1" }), null)
})
