// Coalesce streaming part updates before they reach the store.
//
// Every `message.part.updated` carries the whole accumulated text of its part,
// so applying each one re-renders the bubble and re-parses its markdown. A
// single long run is thousands of deltas; after the app is backgrounded the
// buffered ones arrive in one burst, the store is written on every delta, and
// the JS thread never gets a turn — the UI and navigation freeze until the run
// ends. Keeping only the newest state per part and flushing on a timer costs
// one write per frame instead of one per delta.
export interface PartBatcher<T> {
  push: (item: T) => void
  /** Drop everything queued (used when the connection changes). */
  dispose: () => void
}

export function createPartBatcher<T>(
  key: (item: T) => string,
  flush: (items: T[]) => void,
  delayMs = 40,
): PartBatcher<T> {
  const pending = new Map<string, T>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const run = () => {
    timer = null
    if (pending.size === 0) return
    const items = [...pending.values()]
    pending.clear()
    flush(items)
  }

  return {
    push(item) {
      pending.set(key(item), item)
      if (!timer) timer = setTimeout(run, delayMs)
    },
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
      pending.clear()
    },
  }
}
