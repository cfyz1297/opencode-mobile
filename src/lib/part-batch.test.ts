// Streaming parts are coalesced into one store write per flush window; the
// newest state of each part must be the one that survives.
import { test } from "node:test"
import assert from "node:assert/strict"
import { createPartBatcher } from "./part-batch.ts"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test("batches updates per key and flushes only the newest of each", async () => {
  const flushes: string[][] = []
  const batcher = createPartBatcher<string>((item) => item.split(":")[0], (items) => flushes.push(items), 5)

  batcher.push("a:1")
  batcher.push("b:1")
  batcher.push("a:2")
  assert.deepEqual(flushes, [], "nothing is flushed synchronously")

  await wait(20)
  assert.deepEqual(flushes, [["a:2", "b:1"]])
})

test("dispose drops queued updates", async () => {
  const flushes: string[][] = []
  const batcher = createPartBatcher<string>((item) => item, (items) => flushes.push(items), 5)

  batcher.push("stale")
  batcher.dispose()
  await wait(20)
  assert.deepEqual(flushes, [])
})
