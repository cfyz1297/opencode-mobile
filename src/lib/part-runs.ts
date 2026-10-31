// Turns one message's parts into the chat transcript's render order.
//
// The API delivers parts in the order the model produced them (reasoning,
// text, `shell`, reasoning, `shell`…), but the bubble used to render them
// regrouped: all reasoning first, then all text, then every tool call as its
// own card. A tool-using turn therefore read as "wall of thinking" + "wall of
// cards" instead of the compact timeline the model actually followed.
//
// `groupParts` keeps the original order and folds consecutive tool calls into
// one run, so N back-to-back commands collapse into a single "Ran N commands"
// row that expands on tap.
import type { Part } from "./sdk"

export type PartItem =
  | { kind: "text"; key: string; part: Part }
  | { kind: "reasoning"; key: string; part: Part }
  | { kind: "tools"; key: string; tools: Part[] }

// Text, reasoning and tool calls are the only parts the transcript renders;
// step markers, snapshots, patches, subtasks, retries and agents are
// bookkeeping, and file parts are handled separately as image attachments.
export function groupParts(parts: Part[]): PartItem[] {
  const items: PartItem[] = []
  for (const part of parts) {
    if (part.type === "tool") {
      const last = items[items.length - 1]
      if (last?.kind === "tools") {
        last.tools.push(part)
      } else {
        items.push({ kind: "tools", key: part.id, tools: [part] })
      }
      continue
    }

    if (part.type !== "text" && part.type !== "reasoning") continue

    // Empty text/reasoning parts appear while a step is starting — they would
    // render as blank gaps.
    if (!part.text) continue
    items.push({ kind: part.type, key: part.id, part })
  }
  return items
}

// True when every call in the run is a shell command, which is what makes the
// row read "Ran N commands" instead of "Ran N tools".
export function isCommandRun(tools: Part[]): boolean {
  return tools.length > 0 && tools.every((tool) => tool.tool === "bash")
}
