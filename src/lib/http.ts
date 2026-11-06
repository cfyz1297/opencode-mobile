// Shared low-level HTTP for both transports (V1 and V2). The two SDK files
// used to carry identical copies of fetchWithTimeout()/request(), so a timeout
// or auth-header fix had to be made twice.
import { buildRequestHeaders } from "./headers"
import { ApiError, apiErrorFor, isAuthStatus } from "./api-error"

const REQUEST_TIMEOUT_MS = 30_000

export interface RequestConfig {
  baseUrl: string
  directory?: string
  auth?: {
    username: string
    password: string
  }
}

export function createHeaders(config: RequestConfig): Record<string, string> {
  return buildRequestHeaders(config)
}

// `timeoutMs` lets specific callers (e.g. the onboarding health-check) fail
// faster than the general REQUEST_TIMEOUT_MS used by real session calls.
// Leave it unset to get the default.
export async function request<T>(
  config: RequestConfig,
  path: string,
  options: RequestInit = {},
  timeoutMs?: number,
): Promise<T> {
  const url = `${config.baseUrl}${path}`
  const headers = { ...createHeaders(config), ...options.headers }
  const response = await fetchWithTimeout(
    url,
    {
      ...options,
      headers,
    },
    timeoutMs,
  )

  if (!response.ok) {
    const error = await response.text()
    if (isAuthStatus(response.status)) throw apiErrorFor(response.status, `API Error: ${response.status} - ${error}`)
    throw new ApiError(response.status, error)
  }

  // Both servers return bare 204s for mutations (e.g. DELETE /api/session/{id})
  // — parsing an empty body as JSON would throw.
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  // BUG-016: non-JSON body (HTML proxy page, 502 error page) must surface as
  // an ApiError, not a raw SyntaxError that leaks into the UI.
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(0, `Non-JSON response: ${text.slice(0, 200)}`)
  }
}

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const parentSignal = options.signal
  if (parentSignal?.aborted) throw new Error("Request aborted")

  // timeoutMs <= 0 disables the timer entirely — the request runs until it
  // completes or the parent signal aborts. POST /prompt needs this: some V2
  // servers (2.0.24) hold the POST open until the run finishes, and a
  // client-side timer aborting that connection cancels the run server-side
  // (empty assistant message). See prompt().
  if (!(timeoutMs > 0)) {
    return fetch(url, { ...options, signal: parentSignal })
  }

  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onParentAbort = () => controller.abort()
  parentSignal?.addEventListener("abort", onParentAbort)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (timedOut) {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
    parentSignal?.removeEventListener("abort", onParentAbort)
  }
}
