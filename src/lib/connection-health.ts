import type { Client } from "./sdk"

export type ConnectionHealth = "checking" | "online" | "offline"

// Short deadline: a server that is off must turn the badge grey in seconds,
// not block it for the 30s session timeout. Probes run only while the
// Connections tab is focused (useFocusEffect), so a few a minute cost nothing.
export const CONNECTION_PROBE_TIMEOUT_MS = 5_000

/** Ask the server for its own health; anything but an explicit `healthy: true` means "not reachable". */
export async function probeConnection(
  client: Pick<Client, "global">,
  timeoutMs = CONNECTION_PROBE_TIMEOUT_MS,
): Promise<ConnectionHealth> {
  try {
    const health = await client.global.health(timeoutMs)
    return health?.healthy === true ? "online" : "offline"
  } catch {
    return "offline"
  }
}
