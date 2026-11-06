// Parse a JSON value read from device storage, tolerating corrupted data
// (BUG-016). One copy for every store: the stores used to carry three.
export function parseStoredJSON<T>(raw: string, fallback: T, label: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    console.warn(`Failed to parse ${label}, using fallback`)
    return fallback
  }
}
