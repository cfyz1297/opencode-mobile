// Pure selection helpers for the session list's bulk-delete mode.
// No React Native imports — unit-testable with node --test.

/** Adds or removes one id, returning a new set (React state compares by identity). */
export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** Selects or clears every id of one directory group, leaving other groups alone. */
export function setGroupSelected(selected: ReadonlySet<string>, ids: string[], on: boolean): Set<string> {
  const next = new Set(selected)
  for (const id of ids) {
    if (on) next.add(id)
    else next.delete(id)
  }
  return next
}

/** How much of a group is selected — drives the header checkbox. */
export function groupSelection(selected: ReadonlySet<string>, ids: string[]): "none" | "some" | "all" {
  if (!ids.length) return "none"
  const count = ids.filter((id) => selected.has(id)).length
  if (count === 0) return "none"
  return count === ids.length ? "all" : "some"
}
