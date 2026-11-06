// Session ids arrive from the server *and* from deep links / notification
// payloads. They are interpolated into API paths (`/api/session/${id}`), where
// `..` or `/` would let a crafted link reach a different endpoint with the
// stored credentials. opencode ids are `ses_` + URL-safe characters, so
// anything outside that alphabet is refused at the route boundary.
const SAFE_SESSION_ID = /^[A-Za-z0-9_-]{1,200}$/

export function isSafeSessionId(value: unknown): value is string {
  return typeof value === "string" && SAFE_SESSION_ID.test(value)
}
