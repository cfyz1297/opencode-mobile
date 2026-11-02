// Per-bubble chrome flags for the chat transcript.
//
// A tool-using turn arrives as one assistant message per step (reasoning,
// `shell`, more reasoning, `shell`…). Rendering each step as a full bubble adds
// a repeated header, a token/cost line and a card gap per step, so a long run
// fills the screen with identical chrome. `bubbleFlags` marks the run so only
// the oldest step shows the header and only the newest one shows the totals.
//
// The list is inverted (newest-first), so `index - 1` is the newer neighbour in
// reading order and `index + 1` the older one.
export interface BubbleFlags {
  // The older neighbour is an assistant message: this bubble continues the run
  // above it, so it hides its header.
  continued: boolean
  // No newer assistant message: this is the last step of the run, so it shows
  // the token/cost footer.
  showMeta: boolean
}

export function bubbleFlags(roles: Array<string | undefined>): BubbleFlags[] {
  return roles.map((role, i) => {
    if (role !== "assistant") return { continued: false, showMeta: true }
    return {
      continued: roles[i + 1] === "assistant",
      showMeta: roles[i - 1] !== "assistant",
    }
  })
}

// Tokens and money for a whole run, not for its last step.
//
// Every step is its own assistant message and carries only its own usage, so
// the footer used to report the cost of the final roundtrip — a ten-step run
// looked like it cost a fraction of what it did. The newest step of a run
// (same inverted ordering as bubbleFlags) gets the sum over every assistant
// message back to the previous user turn; all other indices get nothing.
export interface RunTotals {
  tokens: number
  cost: number
}

export interface RunTokens {
  input: number
  output: number
  reasoning?: number
  cache?: { read: number; write: number }
}

export interface Usage {
  role?: string
  tokens?: RunTokens
  cost?: number
  providerID?: string
  modelID?: string
}

/** Per-million prices from the model catalog (see catalog ProviderModel.cost). */
export interface Price {
  input: number
  output: number
  cache?: { read?: number; write?: number }
}

/**
 * Catalog prices for a message's model. V2.2.5 reports `cost: 0` for every
 * step even on paid models (the provider's reported amount wins server-side,
 * and opencode-go reports zero), so the footer has nothing to show unless the
 * catalog price is applied client-side.
 */
export type PriceLookup = (message: Usage) => Price | undefined

const ZERO_PRICE: Price = { input: 0, output: 0 }

function estimateCost(price: Price, usage: RunTokens): number {
  const cache = price.cache
  return (
    (usage.input * price.input +
      (usage.output + (usage.reasoning ?? 0)) * price.output +
      (usage.cache?.read ?? 0) * (cache?.read ?? price.input) +
      (usage.cache?.write ?? 0) * (cache?.write ?? price.input)) /
    1_000_000
  )
}

export function runTotals(messages: Usage[], priceOf?: PriceLookup): Array<RunTotals | undefined> {
  return messages.map((message, i) => {
    if (message.role !== "assistant") return undefined
    // Not the newest step of the run — the footer belongs to the last one.
    if (messages[i - 1]?.role === "assistant") return undefined

    let tokens = 0
    let cost = 0
    let seen = false
    for (let j = i; j < messages.length && messages[j].role === "assistant"; j++) {
      const usage = messages[j].tokens
      const reported = messages[j].cost ?? 0
      if (usage) {
        tokens += usage.input + usage.output
        seen = true
      }
      if (reported > 0) {
        cost += reported
        seen = true
      } else if (usage) {
        // A reported zero is not a price: fall back to the catalog.
        cost += estimateCost(priceOf?.(messages[j]) ?? ZERO_PRICE, usage)
      }
    }
    return seen ? { tokens, cost } : undefined
  })
}
