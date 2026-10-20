import type { Message, Part } from "./sdk"

/**
 * Merge a server `message.updated` event into the current message list.
 *
 * Optimistic sends add placeholder messages with `temp-` ids (see
 * sessions.ts sendMessage). When the real server message arrives we must
 * replace ONLY the oldest still-pending optimistic message of the same role —
 * not every `temp-` message.
 *
 * The bug this guards against: sending a second message while the first is
 * still processing leaves two `temp-` user messages in the list. A naive
 * "drop all temp messages when any real one arrives" would remove BOTH when
 * the first real message lands, so the second (already queued server-side but
 * not yet echoed back) vanishes from the chat until its own event arrives —
 * a "did my message send?" ghosting bug.
 */
export function mergeIncomingMessage(messages: Message[], message: Message): Message[] {
  // Already present (a later update to a message we've seen): replace in place.
  if (messages.some((m) => m.id === message.id)) {
    return messages.map((m) => (m.id === message.id ? message : m))
  }
  // First time we see this real message: resolve the oldest matching temp.
  const tempIdx = messages.findIndex((m) => m.id.startsWith("temp-") && m.role === message.role)
  if (tempIdx !== -1) {
    const next = messages.slice()
    next[tempIdx] = message
    return next
  }
  // No optimistic placeholder to resolve (e.g. an assistant reply): append.
  return [...messages, message]
}

// Clock-skew tolerance when matching an optimistic temp against its server
// copy: temp.created is the device clock, the server copy's time.created is
// the server clock, so allow a small negative difference even though the
// server copy is always stored after the optimistic send.
const TEMP_MATCH_WINDOW_MS = 60_000

/**
 * Sortable signature pairing an optimistic message with its server copy:
 * number of file parts + concatenated text. The temp's file url is a local
 * uri while the server copy's url is a server blob path, so file parts are
 * compared by count only.
 */
function tempSignature(parts: Part[] | undefined): string {
  const p = parts ?? []
  const text = p.filter((x) => x.type === "text").map((x) => x.text ?? "").join("\n")
  const files = p.filter((x) => x.type === "file").length
  return `${files}:${text}`
}

/**
 * Fold freshly fetched server messages with the optimistic `temp-` messages
 * still in state. V2 has no user-message SSE event, so a temp is the only
 * copy of a just-sent message until a full reload includes it — but once the
 * server list DOES contain the real copy, leaving the temp in place
 * duplicates the message (and every further reload accumulates the dupes at
 * the bottom of the chat).
 *
 * A temp is therefore dropped when the fetched list contains the real user
 * message it represents (same role + same text/files signature, created no
 * earlier than the optimistic send); unmatched temps are kept — their run
 * may still be in flight. FIFO pairing (earliest temp ↔ earliest unconsumed
 * copy) keeps repeated identical texts consistent.
 */
export function reconcileTemps(
  fetched: Message[],
  fetchedParts: Record<string, Part[]>,
  prevMessages: Message[],
  prevParts: Record<string, Part[]>,
): { messages: Message[]; parts: Record<string, Part[]> } {
  const temps = prevMessages.filter((m) => m.id.startsWith("temp-"))
  if (temps.length === 0) return { messages: fetched, parts: fetchedParts }

  const claimed = new Set<string>()
  const keptTemps: Message[] = []
  for (const temp of temps) {
    const signature = tempSignature(prevParts[temp.id])
    const real = fetched.find(
      (m) =>
        !claimed.has(m.id) &&
        m.role === temp.role &&
        tempSignature(fetchedParts[m.id]) === signature &&
        m.time.created >= temp.time.created - TEMP_MATCH_WINDOW_MS,
    )
    if (real) {
      // The server copy absorbs the temp: the temp is dropped, the copy stays.
      claimed.add(real.id)
    } else {
      keptTemps.push(temp)
    }
  }

  const parts: Record<string, Part[]> = { ...fetchedParts }
  for (const temp of keptTemps) parts[temp.id] = prevParts[temp.id] ?? []
  // Unconsumed temps render after the server history — they are the newest
  // messages by definition (sent seconds ago).
  return { messages: [...fetched, ...keptTemps], parts }
}
