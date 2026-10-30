import { test } from "node:test"
import assert from "node:assert/strict"
import { toggleSelection, setGroupSelected, groupSelection } from "./session-selection.ts"

test("toggleSelection: adds an unselected id and removes a selected one", () => {
  const once = toggleSelection(new Set<string>(), "a")
  assert.deepEqual([...once], ["a"])

  const twice = toggleSelection(once, "a")
  assert.deepEqual([...twice], [])

  // Must not mutate the input — React state is compared by identity.
  assert.deepEqual([...once], ["a"])
})

test("toggleSelection: keeps unrelated ids", () => {
  const selected = toggleSelection(new Set(["a", "b"]), "c")
  assert.deepEqual([...selected].sort(), ["a", "b", "c"])
})

test("setGroupSelected: selects every id in the group when on", () => {
  const selected = setGroupSelected(new Set(["x"]), ["a", "b"], true)
  assert.deepEqual([...selected].sort(), ["a", "b", "x"])
})

test("setGroupSelected: removes only that group's ids when off", () => {
  const selected = setGroupSelected(new Set(["a", "b", "x"]), ["a", "b"], false)
  assert.deepEqual([...selected], ["x"])
})

test("groupSelection: reports none, some and all", () => {
  assert.equal(groupSelection(new Set<string>(), ["a", "b"]), "none")
  assert.equal(groupSelection(new Set(["a"]), ["a", "b"]), "some")
  assert.equal(groupSelection(new Set(["a", "b"]), ["a", "b"]), "all")
  assert.equal(groupSelection(new Set(["z"]), ["a", "b"]), "none")
})

test("groupSelection: an empty group is none, not all", () => {
  assert.equal(groupSelection(new Set(["a"]), []), "none")
})
