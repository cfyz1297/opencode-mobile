// Pure, transport-agnostic Server-Sent Events framing for the opencode event stream.
// Extracted from sdk.ts so the chunk-buffering rules — which are easy to get wrong when
// a single event is split across two network reads — are unit-testable without a socket.

export class SSEParser {
  private buffer = ""

  /**
   * Feed one decoded text chunk. Returns the `data:` payloads (as raw strings)
   * that completed within this chunk. A partial trailing line is retained and
   * prepended to the next chunk. The `[DONE]` sentinel and empty payloads are
   * filtered out. Lines that are not `data:` frames (comments, `event:`, blanks)
   * are ignored. Callers JSON-parse the returned strings.
   */
  push(chunk: string): string[] {
    this.buffer += chunk
    const lines = this.buffer.split("\n")
    // The last element is whatever came after the final newline — possibly an
    // incomplete line. Hold it until the next chunk completes it.
    this.buffer = lines.pop() ?? ""

    const out: string[] = []
    for (const raw of lines) {
      const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw
      if (line.startsWith("data:")) {
        // SSE permits no space after the colon, or one optional separator.
        // Preserve any further whitespace in the payload itself.
        const value = line.slice(5)
        const data = value.startsWith(" ") ? value.slice(1) : value
        if (data && data !== "[DONE]") out.push(data)
      }
    }
    return out
  }
}
