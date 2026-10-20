// Chat message visibility while a revert is pending — pure logic extracted
// verbatim from app/session/[id].tsx messageData (0.2.10 audit) so the
// lexicographic revert-point comparison is unit-testable with plain
// `node --test` (repo pattern: see message-merge.ts).
//
// While a revert is pending, the reverted message and everything after it
// still exist server-side (cleanup only runs on the next prompt/unrevert)
// — hide them client-side so editing feels immediate. Message IDs are
// lexicographically sortable, same comparison the TUI uses. Optimistic
// "temp-" IDs (assigned client-side before the server responds, see
// sendMessage) aren't part of that sort order — always keep them so a
// message sent concurrently with a revert isn't hidden.
import type { Message, Part } from "./sdk"

export function isHiddenByRevert(messageID: string, revertMessageID: string | null | undefined): boolean {
  if (!revertMessageID) return false
  if (messageID.startsWith("temp-")) return false
  return messageID >= revertMessageID
}

export interface MessageDataItem {
  message: Message
  parts: Part[]
}

/**
 * Assemble the inverted FlatList data for the chat screen: filter messages
 * hidden by the pending revert, attach each message's parts, then reverse so
 * the newest message renders at the bottom of the inverted list.
 */
export function buildMessageData(
  messages: Message[],
  parts: Record<string, Part[]>,
  revertMessageID: string | null | undefined,
): MessageDataItem[] {
  return (messages || [])
    .filter((msg) => !isHiddenByRevert(msg.id, revertMessageID))
    .map((msg) => ({
      message: msg,
      parts: (parts && parts[msg.id]) || [],
    }))
    .reverse()
}
