// Pure formatting for notification bodies, extracted from stores/events.ts so the
// sanitization rules are unit-testable without the event store's RN dependencies.

export const MAX_NOTIF_BODY = 200

/**
 * Make a server-supplied string safe to show in a notification:
 * strip C0 control characters and DEL (which can corrupt the notification shade
 * or hide content), collapse surrounding whitespace, and cap the length. Falls
 * back to `fallback` when the input is empty/whitespace-only or undefined.
 */
export function sanitizeBody(s: string | undefined, fallback: string): string {
  return (s ? s.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, MAX_NOTIF_BODY) : "") || fallback
}

/**
 * Fixed body for a pending permission prompt. The tool name, resource list and
 * command text are server-supplied: rendered in the OS notification shade they
 * are visible on a locked device and give a hostile server a text-injection
 * surface into the notification UI. The detail stays in the app, behind the
 * biometric gate.
 */
export const PERMISSION_NOTIFICATION_BODY = "A tool is waiting for your approval"

/** Fixed body for a pending question — the question text is server-supplied (see above). */
export const QUESTION_NOTIFICATION_BODY = "The assistant has a question"
