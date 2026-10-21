// Pending-question reconciliation for the SSE recovery path.
//
// V2's event stream is volatile: events emitted while the app was backgrounded
// or disconnected are never replayed. The server-side form list is therefore
// authoritative for what is still open. Replacing the local cache (instead of
// merging it) means:
//   - a question created during the outage appears after reconnect/foreground;
//   - a question answered from another client (e.g. the terminal) disappears;
//   - no question is kept alive merely because it was once seen locally.
//
// Optimistic removal is no longer needed: the UI keeps a question mounted
// while its reply is in flight and only removes it after the server confirms,
// so there is no local "already answered" entry for a stale server list to
// resurrect.

export interface PendingQuestionLike {
  id: string
}

/**
 * Adopt the server's pending-question list for one session.
 * Returns a copy so callers cannot mutate the response array by accident.
 */
export function reconcilePendingQuestions<T extends PendingQuestionLike>(
  cached: readonly T[],
  server: readonly T[],
): T[] {
  // `cached` is intentionally unused beyond documenting the contract: the
  // server wins even when it is empty (all questions were answered elsewhere).
  void cached
  return server.slice()
}
