// Keyboard padding from the two payload shapes the app receives:
//
// - `imeInset` from MainActivity (Android): {height, visible} in dp. This is
//   the only signal that works under the bridgeless New Architecture — React
//   Native's own keyboardDidShow never fires there (see MainActivity).
// - React Native's Keyboard event (iOS): {endCoordinates: {height}}.
export type KeyboardSignal = {
  height?: number
  visible?: boolean
  endCoordinates?: { height?: number }
}

/** Bottom padding (dp) that lifts content exactly onto the keyboard; 0 when hidden. */
export function keyboardPadding(signal: KeyboardSignal): number {
  if (signal.visible === false) return 0
  const height = signal.height ?? signal.endCoordinates?.height
  return height != null && Number.isFinite(height) && height > 0 ? height : 0
}
