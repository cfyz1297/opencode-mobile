import { test } from "node:test"
import assert from "node:assert/strict"
import {
  assertNoLiteralSecrets,
  buildCustomProviderPlan,
  configJsonLooksSecretFree,
  normalizeProviderId,
  validateCustomProvider,
} from "./custom-provider.ts"

const valid = {
  id: "acme",
  name: "Acme LLM",
  baseURL: "https://llm.acme.example/v1",
  modelID: "qwen3-coder",
  modelName: "Qwen 3 Coder",
}

test("normalizeProviderId lowercases and hyphenates spaces", () => {
  assert.equal(normalizeProviderId(" My Provider "), "my-provider")
})

test("validateCustomProvider accepts a well-formed Other provider", () => {
  const v = validateCustomProvider(valid)
  assert.equal(v.ok, true)
  assert.deepEqual(v.errors, {})
})

test("validateCustomProvider rejects empty / invalid / reserved ids", () => {
  assert.equal(validateCustomProvider({ ...valid, id: "" }).errors.id, "required")
  assert.equal(validateCustomProvider({ ...valid, id: "1bad" }).errors.id, "invalid")
  assert.equal(validateCustomProvider({ ...valid, id: "OpenAI!" }).errors.id, "invalid")
  assert.equal(validateCustomProvider({ ...valid, id: "opencode" }).errors.id, "reserved")
  assert.equal(validateCustomProvider({ ...valid, id: "other" }).errors.id, "reserved")
})

test("validateCustomProvider rejects bad baseURL and model id", () => {
  assert.equal(validateCustomProvider({ ...valid, baseURL: "not-a-url" }).errors.baseURL, "invalid")
  assert.equal(validateCustomProvider({ ...valid, baseURL: "ftp://x" }).errors.baseURL, "invalid")
  assert.equal(validateCustomProvider({ ...valid, modelID: "has space" }).errors.modelID, "invalid")
  assert.equal(validateCustomProvider({ ...valid, modelID: "" }).errors.modelID, "required")
})

test("buildCustomProviderPlan returns config with env placeholder, never a literal key", () => {
  const plan = buildCustomProviderPlan(valid)
  assert.ok(plan)
  assert.equal(plan!.providerID, "acme")
  assert.match(plan!.configJson, /@ai-sdk\/openai-compatible/)
  assert.match(plan!.configJson, /\{env:ACME_API_KEY\}/)
  assert.doesNotMatch(plan!.configJson, /sk-/)
  assert.ok(plan!.termuxSteps.length >= 4)
  assert.ok(plan!.termuxSteps.some((s) => s.includes("/connect")))
  assert.equal(assertNoLiteralSecrets(plan!), true)
})

test("buildCustomProviderPlan returns null for invalid input", () => {
  assert.equal(buildCustomProviderPlan({ ...valid, id: "" }), null)
})

test("configJsonLooksSecretFree rejects literal apiKey and common key prefixes", () => {
  assert.equal(configJsonLooksSecretFree('"apiKey": "{env:FOO}"'), true)
  assert.equal(configJsonLooksSecretFree('"apiKey": "sk-abcdefghijklmnopqrstuvwxyz"'), false)
  assert.equal(configJsonLooksSecretFree('"apiKey": "AIzaSyDummyGoogleKeyValue123456789012"'), false)
  assert.equal(configJsonLooksSecretFree('"apiKey": "gsk_abcdefghijklmnopqrstuvwxyz"'), false)
})

test("assertNoLiteralSecrets rejects plans that embed sk- tokens in configJson", () => {
  const plan = buildCustomProviderPlan(valid)!
  const poisoned = {
    ...plan,
    configJson: plan.configJson.replace("{env:ACME_API_KEY}", "sk-abcdefghijklmnopqrstuvwxyz"),
  }
  assert.equal(assertNoLiteralSecrets(poisoned), false)
})

test("validateCustomProvider rejects oversized or control-char names", () => {
  assert.equal(validateCustomProvider({ ...valid, name: "a".repeat(81) }).errors.name, "invalid")
  assert.equal(validateCustomProvider({ ...valid, name: "bad\nname" }).errors.name, "invalid")
})
