// Bottom padding (dp) that lifts content exactly onto the soft keyboard.
//
// Android/edge-to-edge (Expo SDK 54, always on): the window never shrinks under
// the IME, so the app has to pad for the keyboard itself. RN reports the IME
// inset *net of the system bars* (ReactRootView: imeInsets.bottom -
// barInsets.bottom) while the app draws to the screen edge, so the bar inset
// has to be added back or the composer stays that far behind the keyboard.
//
// The previous guess — `windowHeight - screenY` — collapsed to the nav-bar
// height on edge-to-edge: the visible display frame does not shrink there, so
// the "keyboard top" it reports is the screen bottom minus the bars, and the
// padding became a few dozen pixels instead of the whole keyboard.
export function keyboardPadding(reportedHeight: number, barInsetBottom: number): number {
  if (!(reportedHeight > 0)) return 0
  return reportedHeight + Math.max(0, barInsetBottom)
}
