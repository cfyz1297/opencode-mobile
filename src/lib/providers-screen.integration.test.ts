import { test } from "node:test"
import assert from "node:assert/strict"
import {
  buildProvidersScreenModel,
  POPULAR_PROVIDERS,
  MIN_POPULAR_PROVIDER_COUNT,
  type CatalogProvider,
} from "./providers-ui.ts"
import { buildCustomProviderPlan } from "./custom-provider.ts"

test("Providers screen model from catalog-shaped providers includes OpenCode + custom", () => {
  assert.ok(POPULAR_PROVIDERS.length >= MIN_POPULAR_PROVIDER_COUNT)

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

  assert.ok(screen.popular.some((p) => p.id === "opencode"), "OpenCode Zen should remain in popular when only Go is connected")
  assert.ok(!screen.popular.some((p) => p.id === "opencode-go"))
  assert.ok(!screen.popular.some((p) => p.id === "beatapi"))
  assert.equal(screen.custom.isCustom, true)

  const plan = buildCustomProviderPlan({
    id: "acme",
    name: "Acme",
    baseURL: "https://api.acme.test/v1",
    modelID: "coder",
  })
  assert.ok(plan)
  assert.match(plan!.configJson, /\{env:ACME_API_KEY\}/)
})
