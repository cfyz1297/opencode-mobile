// Transport check for the connection forms. The app talks to self-hosted
// servers over plain http on purpose (Termux on the same phone, a LAN box), so
// cleartext cannot be forbidden - but a password and the whole chat transcript
// cross the network readable, and the user deserves to know before typing one.

const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i
const LOOPBACK = new Set(["localhost", "0.0.0.0", "::1", "0:0:0:0:0:0:0:1"])

/** True when credentials would cross a network unencrypted: plain http to a non-loopback host. */
export function sendsPasswordInClearText(url: string): boolean {
  const raw = url.trim()
  const scheme = SCHEME.exec(raw)?.[1].toLowerCase()
  // No scheme yet (half-typed input) or https: nothing to warn about.
  if (scheme !== "http") return false

  const authority = raw.slice(SCHEME.exec(raw)![0].length).split(/[/?#]/)[0]
  const host = (
    authority.startsWith("[")
      ? authority.slice(1, authority.indexOf("]"))
      : authority.split(":")[0]
  ).toLowerCase()

  if (!host || LOOPBACK.has(host)) return false
  if (host.endsWith(".localhost")) return false
  // 127.0.0.0/8 is loopback. Test the first octet only: "127.1.2.3" is valid IPv4 shorthand.
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return false
  return true
}
