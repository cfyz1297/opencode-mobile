import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { PROVIDERS_ROUTE } from "./providers-ui.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")

test("PROVIDERS_ROUTE is the Expo path used by Settings and ModelPicker", () => {
  assert.equal(PROVIDERS_ROUTE, "/providers")
})

test("Settings screen navigates to Providers route", () => {
  const src = readFileSync(join(root, "app/(tabs)/settings.tsx"), "utf8")
  assert.match(src, /PROVIDERS_ROUTE/)
  assert.match(src, /router\.push\(PROVIDERS_ROUTE\)/)
  assert.match(src, /settings\.providers\.row\.label/)
})

test("Providers screens are registered in the root Stack", () => {
  const src = readFileSync(join(root, "app/_layout.tsx"), "utf8")
  assert.match(src, /providers\/index/)
  assert.match(src, /providers\/custom/)
})

test("Providers screen lists OpenCode, search, and Other custom entry", () => {
  const src = readFileSync(join(root, "app/providers/index.tsx"), "utf8")
  assert.match(src, /providers-search/)
  assert.match(src, /provider-connect-other/)
  assert.match(src, /CUSTOM_PROVIDER_ROUTE/)
  const catalog = readFileSync(join(root, "src/lib/providers-ui.ts"), "utf8")
  assert.match(catalog, /id: "opencode"/)
  assert.match(catalog, /id: "opencode-go"/)
})

test("Custom provider screen never asks to store API keys", () => {
  const src = readFileSync(join(root, "app/providers/custom.tsx"), "utf8")
  assert.match(src, /noSecretsNote/)
  assert.match(src, /buildCustomProviderPlan/)
  assert.doesNotMatch(src, /SecureStore/)
  assert.doesNotMatch(src, /AsyncStorage/)
  assert.doesNotMatch(src, /apiKey|API key input/i)
})

test("session ModelPicker wires onManageModels to Providers", () => {
  const src = readFileSync(join(root, "app/session/[id].tsx"), "utf8")
  assert.match(src, /onManageModels=\{\(\) => router\.push\(PROVIDERS_ROUTE\)\}/)
})

test("ModelPicker exposes manage callback and search testIDs", () => {
  const src = readFileSync(join(root, "src/components/chat/ModelPicker.tsx"), "utf8")
  assert.match(src, /onManageModels/)
  assert.match(src, /model-picker-manage/)
  assert.match(src, /model-picker-search/)
  assert.match(src, /buildModelPickerSections/)
})

test("ModelPickerModal uses shared filter helper and search field", () => {
  const src = readFileSync(join(root, "src/components/chat/ModelPickerModal.tsx"), "utf8")
  assert.match(src, /buildModelPickerSections/)
  assert.match(src, /model-picker-modal-search/)
})
