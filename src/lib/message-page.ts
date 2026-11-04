// A session page is measured in exchanges, not raw messages.
//
// One user prompt typically produces many assistant records — a step per tool
// call, each with its own text — so "50 messages" was often a single exchange
// and the setting looked like it did nothing. The API limit stays in messages;
// these helpers map a requested number of exchanges onto it and trim the page
// back to whole exchanges.

/** Generous upper bound on records one prompt produces (a step per tool call). */
export const MESSAGES_PER_TURN = 20
export const MIN_TURNS = 1
export const MAX_TURNS = 50
/** "Whole session": the setting's maximum, meaning show everything the server
 *  returns instead of trimming to a number of exchanges. */
export const ALL_TURNS = 0
/** Server rejects a message page larger than this. */
export const MAX_MESSAGE_LIMIT = 200

export function clampTurns(turns: number): number {
  if (turns === ALL_TURNS) return ALL_TURNS
  if (!Number.isFinite(turns)) return MIN_TURNS
  return Math.max(MIN_TURNS, Math.min(MAX_TURNS, Math.floor(turns)))
}

export function isWholeSession(turns: number): boolean {
  return turns === ALL_TURNS
}

/** Message-page size to request for `turns` exchanges. "Whole session" asks for
 *  the largest page the server accepts (200) and pages for the rest. */
export function messageLimitForTurns(turns: number): number {
  if (turns === ALL_TURNS) return MAX_MESSAGE_LIMIT
  return Math.min(MAX_MESSAGE_LIMIT, clampTurns(turns) * MESSAGES_PER_TURN)
}

export function countTurns(messages: readonly { role?: string }[]): number {
  let turns = 0
  for (const message of messages) if (message.role === "user") turns++
  return turns
}

/**
 * Keep the whole transcript the screen already shows when a refresh fetches
 * only the newest page.
 *
 * `load older` pulls the full history and clears `hasMore`; the next refresh
 * (focus, foreground, reconnect) used to replace that with a page trimmed back
 * to the setting, so messages visibly vanished until the session was reopened
 * — and reopening only helped because the short list triggered another full
 * load. Once the history is known to be complete, only the page's own messages
 * are allowed to change.
 */
export function keepLoadedHistory<T extends { id: string }>(
  page: readonly T[],
  previous: readonly T[],
  hadFullHistory: boolean,
): T[] {
  const oldest = page[0]?.id
  if (!hadFullHistory || previous.length === 0 || !oldest) return page.slice()
  const inPage = new Set(page.map((m) => m.id))
  // Only messages strictly older than the page can be kept: anything newer than
  // the page's first message may have been deleted server-side (a revert cleanup
  // removes the messages after its point), and keeping it would resurrect it.
  const older = previous.filter((m) => !inPage.has(m.id) && m.id < oldest)
  return older.length > 0 ? [...older, ...page] : page.slice()
}

/**
 * Keep the newest `turns` exchanges. `trimmed` means older messages were left
 * out, i.e. there is more to load. A page with no user message at all is kept
 * whole — it cannot be measured in exchanges.
 */
export function trimToTurns<T extends { role?: string }>(
  messages: readonly T[],
  turns: number,
): { messages: T[]; trimmed: boolean } {
  const wanted = clampTurns(turns)
  if (wanted === ALL_TURNS) return { messages: messages.slice(), trimmed: false }
  const total = countTurns(messages)
  if (total <= wanted) return { messages: messages.slice(), trimmed: false }

  // Start at the first message of the oldest exchange we keep.
  let seen = 0
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user") continue
    if (seen === total - wanted) return { messages: messages.slice(i), trimmed: true }
    seen++
  }
  return { messages: messages.slice(), trimmed: false }
}
