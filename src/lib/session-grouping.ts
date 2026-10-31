// Pure helpers for grouping the session list by project directory.
// No React Native imports — unit-testable with node --test.

/** A contiguous-by-directory bucket of items, in first-seen order. */
export interface DirectoryGroup<T> {
  directory: string
  items: T[]
}

/**
 * Groups items by their `directory` field, preserving both the original
 * item order within a group and the order in which each directory was
 * first encountered. Does not sort — callers decide presentation order.
 */
export function groupByDirectory<T extends { directory: string }>(items: T[]): DirectoryGroup<T>[] {
  const order: string[] = []
  const buckets = new Map<string, T[]>()

  for (const item of items) {
    const dir = item.directory
    let bucket = buckets.get(dir)
    if (!bucket) {
      bucket = []
      buckets.set(dir, bucket)
      order.push(dir)
    }
    bucket.push(item)
  }

  return order.map((directory) => ({ directory, items: buckets.get(directory) as T[] }))
}

/**
 * Newest-first ordering for the session list. Sorts by `time.updated` (when the
 * session last saw activity) and falls back to `time.created` for payloads
 * without it. Returns a copy — the store's array is left alone.
 *
 * Because `groupByDirectory` keeps first-seen order, sorting before grouping
 * also orders the project groups by their most recently active session.
 */
export function sortByRecency<T extends { time?: { created?: number; updated?: number } }>(items: T[]): T[] {
  const stamp = (item: T) => item.time?.updated ?? item.time?.created ?? 0
  return [...items].sort((a, b) => stamp(b) - stamp(a))
}

