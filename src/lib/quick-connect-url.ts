// Quick Connect URL assembly — pure logic extracted verbatim from
// app/connection/add.tsx buildUrl() (the "quick" mode branch) so it is
// unit-testable with plain `node --test` (repo pattern: pure logic lives in
// src/lib, screens only wire state — see message-merge.ts, scroll-config.ts).
//
// Behavior-preserving extraction (0.2.10 audit): every branch here matches the
// previous inline implementation 1:1. KNOWN BUG pinned by
// quick-connect-url.test.ts ({ skip: "BUG-006" }): an explicitly pasted
// https:// URL still gets the http-era default ":4096" appended — see BUGS.md.

export function quickConnectUrl(rawIp: string, rawPort: string): string {
  const raw = rawIp.trim()
  if (!raw) return ""
  // Be forgiving about pasted values: a full URL, a host:port, or a
  // host with a trailing path. Extract scheme, host, and port so we
  // never produce "http://http://host:4096:4096".
  const schemeMatch = raw.match(/^(https?):\/\//i)
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : "http"
  let rest = raw.replace(/^https?:\/\//i, "")
  rest = rest.split("/")[0] // drop any path/query
  let host = rest
  let pastedPort = ""
  const lastColon = rest.lastIndexOf(":")
  // Only treat trailing ":NNNN" as a port (ignore IPv6 colons / bare host)
  if (lastColon > -1 && /^\d+$/.test(rest.slice(lastColon + 1))) {
    host = rest.slice(0, lastColon)
    pastedPort = rest.slice(lastColon + 1)
  }
  const finalPort = pastedPort || rawPort.trim() || "4096"
  return `${scheme}://${host}:${finalPort}`
}
