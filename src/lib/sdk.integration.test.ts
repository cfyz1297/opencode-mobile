// Exercise the production SDK against a real loopback HTTP server. Only the
// native expo/fetch entry point is replaced by Node's standards-based fetch.
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

type Call = { path: string; method: string; headers: import("node:http").IncomingHttpHeaders; body: Record<string, unknown> }
let calls: Call[] = []
let status = 200
let reply: unknown = { healthy: true, version: "2.0.test" }
let raw: string | undefined
let switchStatus = 204
let delay = 0
let routes: Record<string, { status?: number; body: unknown }> = {}
const server = createServer(async (req, res) => {
  let body = ""
  for await (const chunk of req) body += chunk
  calls.push({ path: req.url!, method: req.method!, headers: req.headers, body: body ? JSON.parse(body) : {} })
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
  const route = routes[req.url!]
  const code = route?.status ?? (req.method === "POST" && /\/(model|agent)$/.test(req.url!) ? switchStatus : status)
  res.writeHead(code, { "Content-Type": req.url === "/api/event" ? "text/event-stream" : "application/json" })
  res.end(code === 204 ? undefined : route ? JSON.stringify(route.body) : raw ?? JSON.stringify(reply))
})
let base: string
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  base = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  hook.deregister()
})
beforeEach(() => { calls = []; status = 200; reply = { healthy: true, version: "2.0.test" }; raw = undefined; switchStatus = 204; delay = 0; routes = {} })

const prompt = { parts: [{ type: "text" as const, text: "hello" }], model: { providerID: "test", modelID: "model-1" }, variant: "high", agent: "build" }

test("SDK normalizes the URL and sends UTF-8 auth and directory headers", async () => {
  const client = createClient({ baseUrl: `${base}///`, directory: "/проект", auth: { username: "имя", password: "пароль" } })
  assert.deepEqual(await client.global.health(), { healthy: true, version: "2.0.test" })
  assert.equal(calls[0].path, "/api/info")
  assert.equal(calls[0].headers.authorization, `Basic ${Buffer.from("имя:пароль").toString("base64")}`)
  assert.equal(calls[0].headers["x-opencode-directory"], encodeURIComponent("/проект"))
})

for (const code of [401, 403]) {
  test(`SDK classifies HTTP ${code} as an authentication error`, async () => {
    status = code
    await assert.rejects(createClient({ baseUrl: base }).global.health(), isAuthError)
  })
}

test("SDK preserves HTTP status on non-auth errors", async () => {
  status = 503
  await assert.rejects(createClient({ baseUrl: base }).global.health(), (error: unknown) => error instanceof ApiError && error.status === 503)
})
test("SDK roots falls back on an older server's 404", async () => {
  status = 404
  assert.equal(await createClient({ baseUrl: base }).file.roots(), null)
})
test("SDK roots propagates server failures rather than treating them as unsupported", async () => {
  status = 500
  await assert.rejects(createClient({ baseUrl: base }).file.roots())
})
test("SDK accepts mutation responses with no content", async () => {
  status = 204
  assert.equal(await createClient({ baseUrl: base }).session.delete("s"), undefined)
  assert.equal(calls[0].method, "DELETE")
})
test("SDK accepts an empty successful response", async () => {
  raw = ""
  assert.equal(await createClient({ baseUrl: base }).session.delete("s"), undefined)
})
test("SDK rejects an HTML proxy response as an API error", async () => {
  raw = "<html>bad gateway</html>"
  await assert.rejects(createClient({ baseUrl: base }).global.health(), ApiError)
})
test("SDK connection probes respect their timeout", async () => {
  delay = 100
  await assert.rejects(createClient({ baseUrl: base }).global.health(15), /timed out after 15ms/)
})

test("SDK loads global sessions, filters roots and searches before limiting", async () => {
  reply = { data: [
    { id: "old", title: "Target old", time: { updated: 1 } },
    { id: "child", title: "Target child", parentID: "old", time: { updated: 10 } },
    { id: "new", title: "Target new", time: { updated: 5 }, location: { directory: "/other" } },
    { id: "different", title: "Elsewhere", time: { updated: 20 } },
  ] }
  const rows = await createClient({ baseUrl: base }).session.list({ roots: true, search: "target", limit: 1 })
  assert.deepEqual(rows.map((s) => s.id), ["new"])
  assert.equal(calls[0].headers["x-opencode-directory"], undefined)
})
test("SDK message paging clamps limits and orders server messages chronologically", async () => {
  reply = { data: [{ id: "a", type: "assistant", content: [{ type: "text", text: "answer" }] }, { id: "u", type: "user", text: "question" }] }
  const rows = await createClient({ baseUrl: base }).session.messages("s", { limit: 999 })
  assert.equal(calls[0].path, "/api/session/s/message?limit=200")
  assert.deepEqual(rows.map((m) => m.info.id), ["u", "a"])
})
test("SDK creates and renames sessions through the production routes", async () => {
  reply = { data: { id: "s", title: "renamed" } }
  const client = createClient({ baseUrl: base })
  assert.equal((await client.session.create({ title: "new" })).id, "s")
  assert.equal((await client.session.update("s", { title: "renamed" })).title, "renamed")
  assert.deepEqual(calls.map((c) => [c.method, c.path]), [["POST", "/api/session"], ["PATCH", "/api/session/s"], ["GET", "/api/session/s"]])
})
test("SDK file browsing retains the location envelope and encodes query paths", async () => {
  reply = { location: { directory: "/project" }, data: [{ path: "file.txt", type: "file" }] }
  const rows = await createClient({ baseUrl: base, directory: "/fallback" }).file.list({ path: "a & b" })
  assert.equal(calls[0].path, "/api/fs/list?path=a+%26+b")
  assert.equal(rows[0].absolute, "/project/file.txt")
})

test("SDK explicitly switches model, reasoning and agent before sending, then skips repeats", async () => {
  status = 204
  const client = createClient({ baseUrl: base })
  await client.session.prompt("same", prompt)
  await client.session.prompt("same", prompt)
  assert.deepEqual(calls.map((c) => c.path), ["/api/session/same/model", "/api/session/same/agent", "/api/session/same/prompt", "/api/session/same/prompt"])
  assert.deepEqual(calls[0].body, { model: { providerID: "test", id: "model-1", variant: "high" } })
})
test("SDK does not guess a model when the user chose none", async () => {
  status = 204
  await createClient({ baseUrl: base }).session.prompt("default", { parts: prompt.parts })
  assert.deepEqual(calls.map((c) => c.path), ["/api/session/default/prompt"])
})
test("SDK model switches are isolated between clients for different servers", async () => {
  status = 204
  await createClient({ baseUrl: base }).session.prompt("shared-id", prompt)
  await createClient({ baseUrl: `${base}/other-server` }).session.prompt("shared-id", prompt)
  assert.ok(calls.some((c) => c.path === "/other-server/api/session/shared-id/model"))
})
test("SDK refuses to send under the wrong model when a switch fails and retries next time", async () => {
  status = 204
  switchStatus = 500
  const client = createClient({ baseUrl: base })
  await assert.rejects(client.session.prompt("switch-fails", prompt))
  assert.ok(!calls.some((c) => c.path.endsWith("/prompt")))
  switchStatus = 204
  await client.session.prompt("switch-fails", prompt)
  assert.equal(calls.filter((c) => c.path.endsWith("/model")).length, 2)
})
test("SDK refuses to send under the wrong agent when its switch fails", async () => {
  status = 204
  switchStatus = 500
  await assert.rejects(createClient({ baseUrl: base }).session.prompt("agent-fails", { parts: prompt.parts, agent: "plan" }))
  assert.ok(!calls.some((c) => c.path.endsWith("/prompt")))
})
test("SDK retries model selection after the prompt itself failed", async () => {
  status = 500
  const client = createClient({ baseUrl: base })
  await assert.rejects(client.session.prompt("prompt-fails", prompt))
  status = 204
  await client.session.prompt("prompt-fails", prompt)
  assert.equal(calls.filter((c) => c.path.endsWith("/model")).length, 2)
})
test("SDK forwards text and attachment URIs in prompts", async () => {
  status = 204
  await createClient({ baseUrl: base }).session.prompt("files", { parts: [...prompt.parts, { type: "text", text: "second" }, { type: "file", mime: "image/png", url: "data:image/png;base64,AA==", filename: "photo.png" }] })
  assert.deepEqual(calls[0].body, { text: "hello\n\nsecond", files: [{ uri: "data:image/png;base64,AA==", name: "photo.png" }] })
})
for (const action of ["prompt", "command"] as const) {
  test(`SDK ${action} preserves auth errors for the connection UI`, async () => {
    status = 401
    const client = createClient({ baseUrl: base })
    await assert.rejects(action === "prompt" ? client.session.prompt("s", { parts: prompt.parts }) : client.session.command("s", { command: "test", arguments: "args" }), isAuthError)
  })
}
test("SDK slash commands use the V2 name/text contract", async () => {
  status = 204
  await createClient({ baseUrl: base }).session.command("s", { command: "review", arguments: "my changes" })
  assert.deepEqual(calls[0].body, { name: "review", text: "my changes" })
})
test("SDK permission replies, question rejection and abort use the session scope", async () => {
  status = 204
  const client = createClient({ baseUrl: base })
  await client.permission.reply("s", "p", "once")
  assert.equal(await client.question.reject("s", "q"), true)
  assert.equal(await client.session.abort("s"), true)
  assert.deepEqual(calls.map((c) => [c.method, c.path]), [["POST", "/api/session/s/permission/p/reply"], ["DELETE", "/api/session/s/form/q"], ["POST", "/api/session/s/interrupt"]])
  assert.deepEqual(calls[0].body, { decision: "once" })
})
test("SDK question replies use actual field IDs and types from form detail", async () => {
  reply = { data: { fields: [{ key: "choice", type: "string", options: [{ label: "Yes", value: "yes" }] }] } }
  await createClient({ baseUrl: base }).question.reply("s", "q", [["Yes"]])
  assert.deepEqual(calls[1].body, { answer: { choice: "yes" } })
})
test("SDK compaction and revert use dedicated V2 endpoints", async () => {
  reply = { data: { id: "s" } }
  const client = createClient({ baseUrl: base })
  assert.equal(await client.session.compact("s"), true)
  await client.session.revert("s", "m")
  await client.session.unrevert("s")
  assert.deepEqual(calls.filter((c) => c.method !== "GET").map((c) => [c.method, c.path, c.body]), [["POST", "/api/session/s/compact", {}], ["POST", "/api/session/s/revert/stage", { messageID: "m" }], ["DELETE", "/api/session/s/revert", {}]])
})

test("SDK streams heartbeat activity and V2 status events over HTTP", async () => {
  raw = ': heartbeat\n\ndata: {"type":"session.execution.started","data":{"sessionID":"s"}}\n\ndata: {"type":"session.execution.succeeded","data":{"sessionID":"s"}}\n\n'
  let activity = 0
  const events = []
  for await (const event of createClient({ baseUrl: base }).global.events(undefined, () => activity++)) events.push(event)
  assert.deepEqual(events.map((e) => e.properties.status), [{ type: "busy" }, { type: "idle" }])
  assert.ok(activity > 0)
  assert.equal(calls[0].headers["accept-encoding"], "identity")
  assert.equal(calls[0].headers["content-type"], undefined)
})
test("SDK stream survives malformed JSON and maps the next event", async () => {
  raw = 'data: broken\n\ndata: {"type":"session.execution.started","data":{"sessionID":"s"}}\n\n'
  const events = []
  for await (const event of createClient({ baseUrl: base }).global.events()) events.push(event)
  assert.equal(events.length, 1)
})
test("SDK stream authentication failures retain their type", async () => {
  status = 403
  await assert.rejects(async () => { for await (const event of createClient({ baseUrl: base }).global.events()) void event }, isAuthError)
})

test("SDK project and path requests use the server location", async () => {
  reply = { directory: "/project/sub", project: { id: "project", directory: "/project" } }
  const client = createClient({ baseUrl: base })
  assert.equal((await client.project.current())?.id, "project")
  assert.deepEqual(await client.path.get(), { home: "/project", worktree: "/project", directory: "/project/sub", state: "", config: "" })
})
test("SDK catalog requests use V2 identifiers and reasoning variants", async () => {
  routes = {
    "/api/model": { body: { data: [{ id: "catalog-id", modelID: "upstream-id", providerID: "p", variants: [{ id: "high" }] }] } },
    "/api/model/default": { body: { data: { id: "catalog-id", providerID: "p" } } },
  }
  const catalog = await createClient({ baseUrl: base }).provider.list()
  assert.deepEqual(catalog.default, { p: "catalog-id" })
  assert.ok(catalog.all[0].models["catalog-id"].variants?.high)
})
test("SDK catalog still loads when the server has no default-model endpoint", async () => {
  routes = {
    "/api/model": { body: { data: [{ id: "model", providerID: "p" }] } },
    "/api/model/default": { status: 404, body: {} },
  }
  const catalog = await createClient({ baseUrl: base }).provider.list()
  assert.deepEqual(catalog.connected, ["p"])
  assert.deepEqual(catalog.default, {})
})
for (const [group, path] of [["project", "/api/project"], ["agent", "/api/agent"], ["command", "/api/command"], ["permission", "/api/permission/request"]] as const) {
  test(`SDK ${group} collection handles an empty wrapped response`, async () => {
    reply = { data: [] }
    assert.deepEqual(await createClient({ baseUrl: base })[group].list(), [])
    assert.equal(calls[0].path, path)
  })
}
test("SDK question collection and config use their V2 routes", async () => {
  reply = { data: [] }
  const client = createClient({ baseUrl: base })
  assert.deepEqual(await client.question.list("s"), [])
  assert.deepEqual(await client.config.get(), { data: [] })
  assert.deepEqual(calls.map((c) => c.path), ["/api/session/s/form", "/api/config"])
})
test("SDK diff loads a session-wide wrapped diff", async () => {
  reply = { data: [{ file: "test.ts", before: "a", after: "b" }] }
  assert.deepEqual(await createClient({ baseUrl: base }).session.diff("s", "ignored"), reply.data)
  assert.equal(calls[0].path, "/api/session/s/diff")
})
test("SDK stream refetches full session details after rename", async () => {
  raw = 'data: {"type":"session.renamed","data":{"sessionID":"s"}}\n\n'
  routes = { "/api/session/s": { body: { data: { id: "s", title: "renamed" } } } }
  const events = []
  for await (const event of createClient({ baseUrl: base }).global.events()) events.push(event)
  assert.equal(events[0].type, "session.updated")
  assert.equal((events[0].properties.info as { title: string }).title, "renamed")
})
test("SDK event state belongs to each connection even when servers reuse message IDs", async () => {
  raw = 'data: {"type":"session.step.started","data":{"sessionID":"shared","assistantMessageID":"shared-message"}}\n\n'
  const first = []
  for await (const event of createClient({ baseUrl: base }).global.events()) first.push(event)
  const second = []
  for await (const event of createClient({ baseUrl: base }).global.events()) second.push(event)
  assert.equal(first[0].type, "message.updated")
  assert.equal(second[0]?.type, "message.updated", "the second connection must create its own assistant message")
})
test("SDK keeps text accumulation across stream reconnects within the same client", async () => {
  const client = createClient({ baseUrl: base })
  raw = 'data: {"type":"session.text.delta","data":{"sessionID":"s","assistantMessageID":"reconnect","delta":"first "}}\n\n'
  for await (const event of client.global.events()) void event
  raw = 'data: {"type":"session.text.delta","data":{"sessionID":"s","assistantMessageID":"reconnect","delta":"second"}}\n\n'
  const events = []
  for await (const event of client.global.events()) events.push(event)
  assert.equal((events[0].properties.part as { text: string }).text, "first second")
})

test("SDK health uses conservative defaults for an empty info object", async () => {
  reply = {}
  assert.deepEqual(await createClient({ baseUrl: base }).global.health(), { healthy: true, version: "unknown" })
})
test("SDK roots returns supported server roots", async () => {
  reply = [{ name: "home", path: "/home" }]
  assert.deepEqual(await createClient({ baseUrl: base }).file.roots(), reply)
})
test("SDK path falls back to canonical project root", async () => {
  reply = { directory: "/project/sub", project: { canonical: "/project" } }
  assert.equal((await createClient({ baseUrl: base }).path.get()).home, "/project")
})
test("SDK a model choice with no reasoning variant leaves variant selection to the server", async () => {
  status = 204
  await createClient({ baseUrl: base }).session.prompt("no-variant", { parts: prompt.parts, model: prompt.model })
  assert.deepEqual(calls[0].body, { model: { providerID: "test", id: "model-1" } })
})
test("SDK an agent-only choice never implicitly switches a model", async () => {
  status = 204
  await createClient({ baseUrl: base }).session.prompt("agent-only", { parts: prompt.parts, agent: "plan" })
  assert.deepEqual(calls.map((c) => c.path), ["/api/session/agent-only/agent", "/api/session/agent-only/prompt"])
})
test("SDK a changed reasoning variant triggers a fresh explicit switch", async () => {
  status = 204
  const client = createClient({ baseUrl: base })
  await client.session.prompt("variant-change", prompt)
  await client.session.prompt("variant-change", { ...prompt, variant: "low" })
  assert.deepEqual(calls.filter((c) => c.path.endsWith("/model")).map((c) => (c.body.model as { variant: string }).variant), ["high", "low"])
})
test("SDK unsupported archive metadata does not send a bad title patch", async () => {
  reply = { data: { id: "s" } }
  await createClient({ baseUrl: base }).session.update("s", { time: { archived: 1 } })
  assert.deepEqual(calls.map((c) => c.method), ["GET"])
})
test("SDK stream continues after an unresolvable session rename", async () => {
  raw = 'data: {"type":"session.renamed","data":{"sessionID":"missing"}}\n\ndata: {"type":"session.execution.succeeded","data":{"sessionID":"s"}}\n\n'
  routes = { "/api/session/missing": { status: 404, body: {} } }
  const events = []
  for await (const event of createClient({ baseUrl: base }).global.events()) events.push(event)
  assert.equal(events.length, 1)
  assert.deepEqual(events[0].properties.status, { type: "idle" })
})

test("Directory clients reuse successful model switches across repeated sends", async () => {
  const { directoryClient } = await import("./directory-client.ts")
  status = 204
  const config = { baseUrl: base }
  const first = directoryClient(config, "/other-project")
  const second = directoryClient(config, "/other-project")
  assert.equal(first, second)
  await first.session.prompt("same-directory", prompt)
  await second.session.prompt("same-directory", prompt)
  assert.equal(calls.filter((c) => c.path.endsWith("/model")).length, 1)
})
test("Directory clients keep different project directories isolated", async () => {
  const { directoryClient } = await import("./directory-client.ts")
  const config = { baseUrl: base }
  const first = directoryClient(config, "/a")
  const second = directoryClient(config, "/b")
  assert.notEqual(first, second)
  await first.global.health()
  await second.global.health()
  assert.deepEqual(calls.map((c) => c.headers["x-opencode-directory"]), ["/a", "/b"])
})
test("Directory clients start fresh after a connection configuration is replaced", async () => {
  const { directoryClient } = await import("./directory-client.ts")
  status = 204
  const first = directoryClient({ baseUrl: base }, "/a")
  const second = directoryClient({ baseUrl: base }, "/a")
  assert.notEqual(first, second)
  await first.session.prompt("replaced-connection", prompt)
  await second.session.prompt("replaced-connection", prompt)
  assert.equal(calls.filter((c) => c.path.endsWith("/model")).length, 2)
})
test("Directory-less clients are cached separately from project-scoped clients", async () => {
  const { directoryClient } = await import("./directory-client.ts")
  const config = { baseUrl: base }
  const global = directoryClient(config)
  assert.equal(global, directoryClient(config))
  assert.notEqual(global, directoryClient(config, "/a"))
  await global.global.health()
  assert.equal(calls[0].headers["x-opencode-directory"], undefined)
})

test("provider.connectApiKey prefers V2 integration connect/key", async () => {
  routes["/api/integration/anthropic/connect/key"] = { status: 204, body: undefined }
  const result = await createClient({ baseUrl: base }).provider.connectApiKey("anthropic", "sk-live-abcdefgh")
  assert.equal(result.path, "/api/integration/anthropic/connect/key")
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, "POST")
  assert.deepEqual(calls[0].body, { key: "sk-live-abcdefgh" })
})

test("provider.connectApiKey falls back to PUT /auth when V2 route is missing", async () => {
  routes["/api/integration/openai/connect/key"] = { status: 404, body: { error: "missing" } }
  routes["/auth/openai"] = { status: 200, body: true }
  const result = await createClient({ baseUrl: base }).provider.connectApiKey("openai", "sk-openai-keyxx")
  assert.equal(result.path, "/auth/openai")
  assert.equal(calls[0].path, "/api/integration/openai/connect/key")
  assert.equal(calls[1].path, "/auth/openai")
  assert.deepEqual(calls[1].body, { type: "api", key: "sk-openai-keyxx" })
})

test("provider.connectApiKey does not fall through on 401", async () => {
  routes["/api/integration/anthropic/connect/key"] = { status: 401, body: { error: "unauthorized" } }
  await assert.rejects(
    createClient({ baseUrl: base }).provider.connectApiKey("anthropic", "sk-live-abcdefgh"),
    isAuthError,
  )
  assert.equal(calls.length, 1)
})
