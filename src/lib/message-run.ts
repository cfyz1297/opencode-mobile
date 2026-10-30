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
