// Regression: a session picked from another project must be created there, not
// in the connection's own directory. The bug lived one layer below this test —
// POST /api/session ignores x-opencode-directory, so a per-directory client is
// only correct if its directory travels in the body as location.directory.
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
const { createClient } = await import("./sdk.ts")
const { directoryClient } = await import("./directory-client.ts")

type Call = { method: string; path: string; headers: import("node:http").IncomingHttpHeaders; body: Record<string, unknown> }
let calls: Call[] = []
const server = createServer(async (req, res) => {
  let body = ""
  for await (const chunk of req) body += chunk
  calls.push({ method: req.method!, path: req.url!, headers: req.headers, body: body ? JSON.parse(body) : {} })
  res.writeHead(200, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ data: { id: "s" } }))
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
beforeEach(() => { calls = [] })

const home = "/data/data/com.termux/files/home"
const daily = `${home}/daily-usage`

test("a client for another project creates the session in that project, not the connection's", async () => {
  const connection = createClient({ baseUrl: base, directory: home })
  await connection.session.create({ title: "in home" })
  await directoryClient({ baseUrl: base }, daily).session.create({ title: "in daily" })

  assert.deepEqual(calls[0].body.location, { directory: home })
  assert.deepEqual(calls[1].body.location, { directory: daily },
    "a project pick must travel in the body: V2 ignores x-opencode-directory on POST /api/session")
  assert.equal(calls[1].headers["x-opencode-directory"], daily)
})

test("per-directory clients stay distinct for a single connection", async () => {
  const connBase = { baseUrl: base }
  const a = directoryClient(connBase, home)
  const b = directoryClient(connBase, daily)
  assert.notEqual(a, b)
  assert.equal(directoryClient(connBase, daily), b)
})
