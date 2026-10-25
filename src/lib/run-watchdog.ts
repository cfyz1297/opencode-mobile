// Decide when a *single running session* has gone quiet long enough that the
// client is probably behind its server.
//
// Why this exists next to stream-watchdog.ts: that one watches the whole SSE
// socket. The server heartbeats every ~15s, so a socket can look perfectly
// healthy while the events of one run never arrive (dropped chunk, a status
// transition the app never saw, an event lost across a reconnect). The app
// then shows "Working..." and an empty assistant bubble forever, while the
// answer already sits on the server — it only appears after leaving and
// re-entering the session, because that triggers a fresh transcript fetch.
//
// Recovery is a cheap authenticated GET of the session's transcript, so the
// error we must avoid is the opposite one: polling a run that is streaming
// normally. Silence is measured per session from its own last event, and at
// most one fetch is allowed per quiet window.

/** Longest believable gap between events of a run that is actually streaming. */
export const RUN_QUIET_MS = 12_000

export interface RunSample {
  sessionID: string
  /** Last session-scoped event seen for this run (status, message, part). */
  lastEventAt: number
  /** Last transcript resync attempt for this run, if any. */
  lastResyncAt?: number
  /** Server already confirmed this run finished; nothing to recover. */
  idle?: boolean
}

/** IDs of runs whose transcript should be re-fetched now. */
export function runsNeedingResync(runs: RunSample[], now: number, quietMs = RUN_QUIET_MS): string[] {
  return runs
    .filter((run) => {
      if (run.idle) return false
      if (now - run.lastEventAt < quietMs) return false
      return run.lastResyncAt === undefined || now - run.lastResyncAt >= quietMs
    })
    .map((run) => run.sessionID)
}
