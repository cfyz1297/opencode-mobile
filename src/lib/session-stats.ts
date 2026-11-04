// Session-wide usage numbers, shared by the header ring and the info panel so
// the two can never disagree.
import type { Message } from "./sdk"

export interface SessionStats {
  /** Spend for the whole session, not just the loaded page. */
  cost: number
  /** Tokens occupying the context window right now (last assistant turn). */
  total: number
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  /** Context window size of the model that produced the last turn, 0 if unknown. */
  context: number
  percent: number
}

export function computeSessionStats(
  messages: readonly Message[],
  providers: readonly { id: string; models: readonly { id: string; limit?: { context?: number } }[] }[],
  /** Server-side session totals (V2 `/api/session/{id}`), preferred when known. */
  session?: { cost?: number; tokens?: { input: number; output: number; reasoning?: number; cache?: { read: number; write: number } } } | null,
): SessionStats {
  let cost = 0
  let last: Message | null = null

  for (const msg of messages) {
    if (msg.role !== "assistant") continue
    if (msg.cost) cost += msg.cost
    if (msg.tokens && msg.tokens.output > 0) last = msg
  }

  // The page of messages only covers what has been loaded, so the sum above is
  // understated for a long session. The session record is cumulative and is the
  // number to show; the sum stays as the fallback for servers without it.
  const total = typeof session?.cost === "number" && session.cost > 0 ? session.cost : cost

  const tokens = last?.tokens
  const input = tokens?.input || 0
  const output = tokens?.output || 0
  const reasoning = tokens?.reasoning || 0
  const cacheRead = tokens?.cache?.read || 0
  const cacheWrite = tokens?.cache?.write || 0
  const contextTokens = input + output + reasoning + cacheRead + cacheWrite

  let context = 0
  if (last?.providerID && last?.modelID) {
    const provider = providers.find(
      (p) => p.id === last!.providerID,
    )
    const model = provider?.models.find((m) => m.id === last!.modelID)
    context = model?.limit?.context || 0
  }
  // Clamped: a ring or bar cannot render past 100, and cache reads can push the
  // raw ratio above it once the window is nearly full.
  const percent = context > 0 ? Math.min(100, Math.round((contextTokens / context) * 100)) : 0

  return { cost: total, total: contextTokens, input, output, reasoning, cacheRead, cacheWrite, context, percent }
}

/** Colour for a fill level: green below half, amber approaching the limit, red past 80%. */
export function fillColor(percent: number): string {
  if (percent > 80) return "#ef4444"
  if (percent > 50) return "#f59e0b"
  return "#3b82f6"
}
