// Persistence of the "messages per page" preference.
//
// The store was only inspectable on a device until now, which is how a broken
// round-trip could survive a release: `load()` and `setPageSize()` both touch
// SecureStore, and nothing proved that what one writes the other reads back on
// the next launch. This runs the real store against an in-memory SecureStore.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")

const STORE = new Map<string, string>()

function freshStore() {
  const source = readFileSync(new URL("../stores/settings.ts", import.meta.url), "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText

  const modules: Record<string, unknown> = {
    zustand: {
      create: (initializer: (set: unknown, get: unknown) => unknown) => {
        let state = initializer(
          (partial: unknown) =>
            (state = { ...(state as object), ...(typeof partial === "function" ? partial(state) : partial) }),
          () => state,
        )
        return Object.assign(() => state, { getState: () => state })
      },
    },
    "expo-secure-store": {
      getItemAsync: async (key: string) => STORE.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => {
        STORE.set(key, value)
      },
    },
    "../lib/notifications": { defaultPreferences: { permissions: true, questions: true } },
    "../lib/settings-merge": {
      mergeStoredSettings: (defaults: object, parsed: object) => ({ ...defaults, ...parsed }),
    },
    "../lib/message-page": { clampTurns: (turns: number) => Math.max(1, Math.min(50, Math.floor(turns))) },
    "../lib/i18n/config": { setAppLocale: () => {} },
  }

  const exports: Record<string, any> = {}
  runInNewContext(output, {
    exports,
    module: { exports },
    require: (id: string) => {
      if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`)
      return modules[id]
    },
    console: { warn: () => {}, log: () => {}, error: () => {} },
    JSON,
    Math,
    Object,
    Promise,
  })
  return exports.useSettings
}

test("the page size survives a restart", async () => {
  STORE.clear()

  const first = freshStore()
  await first.getState().load()
  await first.getState().setPageSize(25)

  // Next launch: a brand new store instance reading the same device storage.
  const second = freshStore()
  await second.getState().load()
  assert.equal(second.getState().pageSize, 25)
})

test("settings stored before the exchange-based page size fall back to the default", async () => {
  STORE.clear()
  // v1 wrote pageSize in raw messages and had no settingsVersion. Treating a
  // stored 200 as 200 exchanges would open a whole session at once.
  STORE.set("opencode_settings", JSON.stringify({ pageSize: 200, notifications: { questions: false } }))

  const store = freshStore()
  await store.getState().load()
  assert.equal(store.getState().pageSize, 10)
  assert.equal(store.getState().notifications.questions, false, "other preferences are kept")
})

test("changing the page size does not drop the other preferences", async () => {
  STORE.clear()
  const store = freshStore()
  await store.getState().load()
  await store.getState().setNotification("questions", false)
  await store.getState().setPageSize(25)
  await store.getState().setLocale("ru")

  const next = freshStore()
  await next.getState().load()
  assert.equal(next.getState().pageSize, 25)
  assert.equal(next.getState().notifications.questions, false)
  assert.equal(next.getState().locale, "ru")
})
