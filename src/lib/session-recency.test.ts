// Ordering of the session list. The server returns sessions in whatever order
// its store hands them back, and the store merges list results with
// session.created events by ID — so screening order depended on history rather
// than recency. The list is ordered newest-first here, before grouping, so both
// the groups (ordered by their newest session) and the rows inside a group show
// recent work at the top.
import { test } from "node:test"
import assert from "node:assert/strict"
import { sortByRecency, groupByDirectory } from "./session-grouping.ts"

const at = (id: string, updated: number, created = updated, directory = "/a") => ({
  id,
  directory,
  time: { created, updated },
})

test("sortByRecency: newest updated first, oldest last", () => {
  const sorted = sortByRecency([at("old", 100), at("new", 3000), at("mid", 900)])
  assert.deepEqual(
    sorted.map((s) => s.id),
    ["new", "mid", "old"],
  )
})

test("sortByRecency: falls back to created when updated is missing", () => {
  const sorted = sortByRecency([
    { id: "onlyCreated", directory: "/a", time: { created: 500 } },
    at("updated", 100),
  ] as never)
  assert.deepEqual(
    sorted.map((s) => s.id),
    ["onlyCreated", "updated"],
  )
})

test("sortByRecency: does not mutate the input array", () => {
  const input = [at("old", 100), at("new", 200)]
  sortByRecency(input)
  assert.deepEqual(
    input.map((s) => s.id),
    ["old", "new"],
  )
})

test("sorted sessions keep grouping by project, groups ordered by newest session", () => {
  // /b holds the most recent session, so its group comes first.
  const sessions = sortByRecency([
    at("a1", 100, 100, "/a"),
    at("b1", 500, 400, "/b"),
    at("a2", 300, 200, "/a"),
  ])
  const groups = groupByDirectory(sessions)
  assert.deepEqual(
    groups.map((g) => g.directory),
    ["/b", "/a"],
  )
  // Within a project the newest session is on top.
  assert.deepEqual(
    groups[1].items.map((s) => s.id),
    ["a2", "a1"],
  )
})
