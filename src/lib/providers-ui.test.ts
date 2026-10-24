import { test } from "node:test"
import assert from "node:assert/strict"
import {
  POPULAR_PROVIDERS,
  buildProvidersScreenModel,
  connectionBadgeFor,
  isFreeModel,
  type CatalogProvider,
} from "./providers-ui.ts"

function provider(partial: Partial<CatalogProvider> & Pick<CatalogProvider, "id">): CatalogProvider {
  return {
    name: partial.name ?? partial.id,
    connected: partial.connected ?? true,
    models: partial.models ?? [{ id: "m1", name: "Model 1" }],
    ...partial,
  }
}

test("buildProvidersScreenModel: empty connected keeps full popular list", () => {
  const model = buildProvidersScreenModel([])
  assert.equal(model.connected.length, 0)
  assert.equal(model.popular.length, POPULAR_PROVIDERS.length)
  assert.deepEqual(
    model.popular.map((p) => p.id).sort(),
    POPULAR_PROVIDERS.map((p) => p.id).sort(),
  )
})

test("buildProvidersScreenModel: connected rows come from catalog with model counts", () => {
  const model = buildProvidersScreenModel([
    provider({ id: "opencode-go", name: "OpenCode Go", models: [{ id: "a", name: "A" }, { id: "b", name: "B" }] }),
    provider({ id: "beatapi", name: "BeatAPI", models: [{ id: "c", name: "C" }] }),
  ])
  assert.equal(model.connected.length, 2)
  assert.equal(model.connected[0].id, "opencode-go")
  assert.equal(model.connected[0].modelCount, 2)
  assert.equal(model.connected[0].name, "OpenCode Go")
  assert.equal(model.connected[1].modelCount, 1)
})

test("buildProvidersScreenModel: popular excludes already-connected ids", () => {
  const connectedIds = ["anthropic", "openai"]
  const model = buildProvidersScreenModel(
    connectedIds.map((id) => provider({ id, name: id })),
  )
  const popularIds = model.popular.map((p) => p.id)
  assert.ok(!popularIds.includes("anthropic"))
  assert.ok(!popularIds.includes("openai"))
  assert.ok(popularIds.includes("github-copilot") || popularIds.includes("copilot"))
})

test("buildProvidersScreenModel: all popular connected yields empty popular", () => {
  const model = buildProvidersScreenModel(
    POPULAR_PROVIDERS.map((p) => provider({ id: p.id, name: p.name })),
  )
  assert.equal(model.popular.length, 0)
  assert.equal(model.connected.length, POPULAR_PROVIDERS.length)
})

test("connectionBadgeFor: account-style ids vs api-key", () => {
  assert.equal(connectionBadgeFor("opencode"), "account")
  assert.equal(connectionBadgeFor("opencode-go"), "account")
  assert.equal(connectionBadgeFor("opencode-zen"), "account")
  assert.equal(connectionBadgeFor("github-copilot"), "account")
  assert.equal(connectionBadgeFor("copilot"), "account")
  assert.equal(connectionBadgeFor("beatapi"), "api_key")
  assert.equal(connectionBadgeFor("anthropic"), "api_key")
  assert.equal(connectionBadgeFor("openai"), "api_key")
})

test("buildProvidersScreenModel: UI rows never expose secret fields", () => {
  const model = buildProvidersScreenModel([
    provider({ id: "beatapi", name: "BeatAPI" }),
  ])
  const forbidden = new Set(["apiKey", "api_key", "token", "accessToken", "secret", "password", "credential"])
  for (const row of [...model.connected, ...model.popular]) {
    for (const key of Object.keys(row)) {
      assert.equal(forbidden.has(key), false, `unexpected secret-like field: ${key}`)
    }
    // Values must not look like credentials either (badge enum "api_key" is a label, not a secret).
    for (const [key, value] of Object.entries(row)) {
      if (key === "badge") continue
      if (typeof value === "string") {
        assert.doesNotMatch(value, /sk-[a-zA-Z0-9]{8,}/)
        assert.doesNotMatch(value, /Bearer\s+\S+/i)
      }
    }
  }
})

test("isFreeModel: zero or missing cost is free; positive cost is not", () => {
  assert.equal(isFreeModel(undefined), true)
  assert.equal(isFreeModel({ input: 0, output: 0 }), true)
  assert.equal(isFreeModel({ input: 0, output: undefined }), true)
  assert.equal(isFreeModel({ input: 1, output: 0 }), false)
  assert.equal(isFreeModel({ input: 0, output: 2 }), false)
})
