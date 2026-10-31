// Turns one message's parts into the chat transcript's render order.
//
// The API delivers parts in the order the model produced them (reasoning,
// text, `shell`, reasoning, `shell`…), but the bubble used to render them
// regrouped: all reasoning first, then all text, then every tool call as its
// own card. A tool-using turn therefore read as "wall of thinking" + "wall of
// cards" instead of the compact timeline the model actually followed.
//
// `groupParts` keeps the order but folds each segment between text parts into
// two rows: one reasoning block and one "Ran N commands" row. That is what the
// desktop transcript shows — a step that thinks and runs three commands is two
// lines, not four.
import type { Part } from "./sdk"

export type PartItem =
  | { kind: "text"; key: string; part: Part }
  | { kind: "reasoning"; key: string; part: Part }
  | { kind: "tools"; key: string; tools: Part[] }

// Text, reasoning and tool calls are the only parts the transcript renders;
// step markers, snapshots, patches, subtasks, retries and agents are
// bookkeeping, and file parts are handled separately as image attachments.
//
// Text is a hard boundary: tools before and after an answer stay separate
// runs, because the answer explains why the next batch started. Reasoning is
// not — the model interleaves "think, run, think, run" between two answers,
// and splitting there is what filled the screen with alternating rows.
export function groupParts(parts: Part[]): PartItem[] {
  const items: PartItem[] = []
  let reasoning: Part | null = null
  let reasoningTexts: string[] = []
  let tools: Part[] = []

  // One segment = the reasoning and tool calls between two text parts.
  const flush = () => {
    if (reasoning) {
      const text = reasoningTexts.join("\n\n")
      items.push({
        kind: "reasoning",
        key: reasoning.id,
        // A merged block spans several steps, so the first step's duration
        // would be a lie — drop it and let the row read plain "Thought".
        part: { ...reasoning, text, time: reasoningTexts.length > 1 ? undefined : reasoning.time },
      })
    }
    if (tools.length) items.push({ kind: "tools", key: tools[0].id, tools })
    reasoning = null
    reasoningTexts = []
    tools = []
  }

  for (const part of parts) {
    if (part.type === "tool") {
      tools.push(part)
      continue
    }

    if (part.type === "reasoning") {
      // Empty reasoning parts appear while a step is starting — they would
      // render as blank gaps.
      if (!part.text) continue
      if (!reasoning) reasoning = part
      reasoningTexts.push(part.text)
      continue
    }

    if (part.type !== "text") continue
    if (!part.text) continue
    flush()
    items.push({ kind: "text", key: part.id, part })
  }
  flush()
  return items
}

// True when every call in the run is a shell command, which is what makes the
// row read "Ran N commands" instead of "Ran N tools". V2 renamed `bash` to
// `shell`, so both names count.
export function isCommandRun(tools: Part[]): boolean {
  return tools.length > 0 && tools.every((tool) => tool.tool === "bash" || tool.tool === "shell")
}
