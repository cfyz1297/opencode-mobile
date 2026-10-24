import { test } from "node:test"
import assert from "node:assert/strict"
import { buildProvidersScreenModel, POPULAR_PROVIDERS, type CatalogProvider } from "./providers-ui.ts"

/**
 * Integration-style: shape that catalog store exposes after provider.list()
 * mapping — connected providers with models become Providers screen rows;
 * popular list has no duplicates of connected ids.
 */
test("Providers screen model from catalog-shaped providers", () => {
  const catalogProviders: CatalogProvider[] = [
    {
      id: "opencode-go",
      name: "OpenCode Go",
      connected: true,
      models: [
        { id: "deepseek-v4", name: "DeepSeek V4.1 Flash" },
        { id: "other", name: "Other" },
      ],
    },
    {
      id: "beatapi",
      name: "BeatAPI",
      connected: true,
      models: [{ id: "free", name: "DeepSeek Free", free: true }],
    },
  ]

  const screen = buildProvidersScreenModel(catalogProviders)

  assert.deepEqual(
    screen.connected.map((r) => ({ id: r.id, modelCount: r.modelCount, badge: r.badge })),
    [
      { id: "opencode-go", modelCount: 2, badge: "account" },
      { id: "beatapi", modelCount: 1, badge: "api_key" },
    ],
  )

  const popularIds = screen.popular.map((p) => p.id)
  assert.ok(!popularIds.includes("beatapi"))
  assert.ok(popularIds.includes("anthropic"))
  assert.ok(popularIds.includes("openai"))
  assert.equal(
    screen.popular.length,
    POPULAR_PROVIDERS.filter((p) => p.id !== "beatapi").length,
  )
})
