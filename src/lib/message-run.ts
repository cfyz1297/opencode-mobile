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

export interface Usage {
  role?: string
  tokens?: { input: number; output: number }
  cost?: number
}

export function runTotals(messages: Usage[]): Array<RunTotals | undefined> {
  return messages.map((message, i) => {
    if (message.role !== "assistant") return undefined
    // Not the newest step of the run — the footer belongs to the last one.
    if (messages[i - 1]?.role === "assistant") return undefined

    let tokens = 0
    let cost = 0
    let seen = false
    for (let j = i; j < messages.length && messages[j].role === "assistant"; j++) {
      const usage = messages[j].tokens
      if (usage) {
        tokens += usage.input + usage.output
        seen = true
      }
      if (messages[j].cost) {
        cost += messages[j].cost!
        seen = true
      }
    }
    return seen ? { tokens, cost } : undefined
  })
}
