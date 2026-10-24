import { test } from "node:test"
import assert from "node:assert/strict"
import { buildModelPickerSections } from "./model-picker-filter.ts"

const providers = [
  {
    id: "opencode-go",
    name: "OpenCode Go",
    models: [
      { id: "deepseek-v4-flash", name: "DeepSeek V4.1 Flash" },
      { id: "other", name: "Other Model" },
    ],
  },
  {
    id: "beatapi",
    name: "BeatAPI",
    models: [
      { id: "deepseek-v4-free", name: "DeepSeek V4 Flash Free", free: true },
      { id: "gpt-like", name: "GPT Like" },
    ],
  },
]

test("empty query returns all providers with models", () => {
  const sections = buildModelPickerSections({ providers, query: "", selected: null })
  assert.equal(sections.length, 2)
  assert.equal(sections[0].title, "OpenCode Go")
  assert.equal(sections[0].data.length, 2)
  assert.equal(sections[1].data.length, 2)
})

test("filters by model name", () => {
  const sections = buildModelPickerSections({ providers, query: "deepseek", selected: null })
  assert.equal(sections.length, 2)
  assert.deepEqual(
    sections.flatMap((s) => s.data.map((m) => m.modelID)),
    ["deepseek-v4-flash", "deepseek-v4-free"],
  )
})

test("filters by provider name and drops empty sections", () => {
  const sections = buildModelPickerSections({ providers, query: "beat", selected: null })
  assert.equal(sections.length, 1)
  assert.equal(sections[0].title, "BeatAPI")
  assert.equal(sections[0].data.length, 2)
})

test("query with no matches yields empty sections", () => {
  const sections = buildModelPickerSections({ providers, query: "zzzz-nope", selected: null })
  assert.equal(sections.length, 0)
})

test("selected model rises to top of its group and its section rises", () => {
  const selected = { providerID: "beatapi", modelID: "gpt-like" }
  const sections = buildModelPickerSections({ providers, query: "", selected })
  assert.equal(sections[0].title, "BeatAPI")
  assert.equal(sections[0].data[0].modelID, "gpt-like")
  assert.equal(sections[0].data[0].modelName, "GPT Like")
})

test("preserves free flag on rows", () => {
  const sections = buildModelPickerSections({ providers, query: "free", selected: null })
  assert.equal(sections.length, 1)
  assert.equal(sections[0].data[0].free, true)
})
