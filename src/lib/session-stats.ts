// Session-wide usage numbers, shared by the header ring and the info panel so
// the two can never disagree.
import type { Message } from "./sdk"
import { estimateCost, type Price } from "./message-run.ts"

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
  providers: readonly { id: string; models: readonly { id: string; limit?: { context?: number }; cost?: Price }[] }[],
  /** Server-side session totals (V2 `/api/session/{id}`), preferred when known. */
  session?: { cost?: number; tokens?: { input: number; output: number; reasoning?: number; cache?: { read: number; write: number } } } | null,
): SessionStats {
  let cost = 0
  let last: Message | null = null

  const modelOf = (msg: Message) =>
    msg.providerID && msg.modelID
      ? providers.find((p) => p.id === msg.providerID)?.models.find((m) => m.id === msg.modelID)
      : undefined

  for (const msg of messages) {
    if (msg.role !== "assistant") continue
    if (msg.cost) cost += msg.cost
    else {
      // Reported zero is not a price (opencode-go sends none at all), so a
      // live run would otherwise sit at "free" until the session record
      // catches up. Price the step from the catalog like the bubble footer.
      const price = modelOf(msg)?.cost
      if (price && msg.tokens) cost += estimateCost(price, msg.tokens)
    }
    if (msg.tokens && msg.tokens.output > 0) last = msg
  }

  const model = last ? modelOf(last) : undefined

  // The page of messages only covers what has been loaded, so the sum above is
  // understated for a long session. The session record is cumulative: its cost
  // wins when the server sends one, and its token counts are priced from the
  // catalog when the server sends zero (opencode-go). The page sum is the last
  // resort for servers that report per-message amounts only.
  const catalogCost =
    session?.tokens && model?.cost
      ? estimateCost(model.cost, {
          input: session.tokens.input,
          output: session.tokens.output,
          reasoning: session.tokens.reasoning,
          cache: session.tokens.cache,
        })
      : 0
  const total =
    typeof session?.cost === "number" && session.cost > 0 ? session.cost : catalogCost > 0 ? catalogCost : cost

  const tokens = last?.tokens
  const input = tokens?.input || 0
  const output = tokens?.output || 0
  const reasoning = tokens?.reasoning || 0
  const cacheRead = tokens?.cache?.read || 0
  const cacheWrite = tokens?.cache?.write || 0
  const contextTokens = input + output + reasoning + cacheRead + cacheWrite

  const context = model?.limit?.context || 0
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
