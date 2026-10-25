import { test } from "node:test"
import assert from "node:assert/strict"
import { CONNECTION_PROBE_TIMEOUT_MS, probeConnection } from "./connection-health.ts"

function client(result: () => Promise<{ healthy: boolean }>, seen: number[] = []) {
  return {
    global: {
      health: (timeoutMs?: number) => {
        seen.push(timeoutMs ?? -1)
        return result()
      },
    },
  }
}

test("probe reports online only for a healthy server", async () => {
  assert.equal(await probeConnection(client(async () => ({ healthy: true }))), "online")
  assert.equal(await probeConnection(client(async () => ({ healthy: false }))), "offline")
})

test("probe reports offline when the server is unreachable", async () => {
  const reason = new Error("Network request failed")
  assert.equal(await probeConnection(client(async () => { throw reason })), "offline")
})

test("only an explicit healthy true counts as online", async () => {
  const body = (value: unknown) => client(async () => value as { healthy: boolean })
  assert.equal(await probeConnection(body({})), "offline")
  assert.equal(await probeConnection(body({ healthy: "true" })), "offline")
  assert.equal(await probeConnection(body({ healthy: 1 })), "offline")
})

test("probe uses a short deadline so the badge cannot hang", async () => {
  const seen: number[] = []
  await probeConnection(client(async () => ({ healthy: true }), seen))
  assert.deepEqual(seen, [CONNECTION_PROBE_TIMEOUT_MS])
  assert.ok(CONNECTION_PROBE_TIMEOUT_MS > 0 && CONNECTION_PROBE_TIMEOUT_MS <= 10_000)

  const custom: number[] = []
  await probeConnection(client(async () => ({ healthy: true }), custom), 1234)
  assert.deepEqual(custom, [1234])
})
