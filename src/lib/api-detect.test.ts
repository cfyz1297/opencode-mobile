import { test } from "node:test"
import assert from "node:assert/strict"
import { detectServerApi, type ProbeResponse } from "./api-detect.ts"

function responder(map: Record<string, ProbeResponse>) {
  const calls: string[] = []
  return {
    calls,
    probe: async (path: string) => {
      calls.push(path)
      return map[path] ?? { status: 404, contentType: "text/plain", body: "not found" }
    },
  }
}

const json = (body: unknown, status = 200): ProbeResponse => ({
  status,
  contentType: "application/json; charset=utf-8",
  body: JSON.stringify(body),
})
const html = (status = 200): ProbeResponse => ({
  status,
  contentType: "text/html; charset=utf-8",
  body: "<!doctype html><title>opencode</title>",
})

test("v2 answers /api/info with JSON, including its version", async () => {
  const { probe, calls } = responder({ "/api/info": json({ version: "2.0.26", healthy: true }) })
  assert.deepEqual(await detectServerApi(probe), { api: "v2", version: "2.0.26" })
  assert.deepEqual(calls, ["/api/info"])
})

test("an auth rejection on /api/info does not choose a generation (v1 looks the same)", async () => {
  const { probe, calls } = responder({ "/api/info": json({ error: "unauthorized" }, 401) })
  assert.deepEqual(await detectServerApi(probe), { api: undefined })
  assert.deepEqual(calls, ["/api/info"])
})

test("a 403 on /api/info is equally ambiguous", async () => {
  const { probe } = responder({ "/api/info": json({ error: "forbidden" }, 403) })
  assert.deepEqual(await detectServerApi(probe), { api: undefined })
})

test("v1 falls through /api/info to the SPA and answers /global/health with JSON", async () => {
  const { probe, calls } = responder({
    "/api/info": html(),
    "/global/health": json({ healthy: true, version: "1.18.34" }),
  })
  assert.deepEqual(await detectServerApi(probe), { api: "v1", version: "1.18.34" })
  assert.deepEqual(calls, ["/api/info", "/global/health"])
})

test("a v1 route that wants credentials still identifies the server", async () => {
  const { probe } = responder({
    "/api/info": html(),
    "/global/health": json({ error: "unauthorized" }, 403),
  })
  assert.deepEqual(await detectServerApi(probe), { api: "v1" })
})

test("HTML 200 on both routes is not a server API", async () => {
  const { probe, calls } = responder({ "/api/info": html(), "/global/health": html() })
  await assert.rejects(detectServerApi(probe), /Unsupported server/)
  // Both routes must be tried before giving up: a v1 server answers HTML on
  // the v2 route by design.
  assert.deepEqual(calls, ["/api/info", "/global/health"])
})

test("an unreachable first route surfaces the network error instead of falling through", async () => {
  const probe = async () => {
    throw new Error("Network request failed")
  }
  await assert.rejects(detectServerApi(probe), /Network request failed/)
})
