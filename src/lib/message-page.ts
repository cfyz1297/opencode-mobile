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
/** Server rejects a message page larger than this. */
export const MAX_MESSAGE_LIMIT = 200

export function clampTurns(turns: number): number {
  if (!Number.isFinite(turns)) return MIN_TURNS
  return Math.max(MIN_TURNS, Math.min(MAX_TURNS, Math.floor(turns)))
}

/** Message-page size to request for `turns` exchanges. */
export function messageLimitForTurns(turns: number): number {
  return Math.min(MAX_MESSAGE_LIMIT, clampTurns(turns) * MESSAGES_PER_TURN)
}

export function countTurns(messages: readonly { role?: string }[]): number {
  let turns = 0
  for (const message of messages) if (message.role === "user") turns++
  return turns
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
