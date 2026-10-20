import { useEffect, useState } from "react"
import { Dimensions, Keyboard, Platform } from "react-native"

/**
 * Bottom padding (px) needed to lift content exactly above the soft keyboard
 * — 0 when the keyboard is hidden.
 *
 * Instead of trusting the event's `height` field we derive the padding from
 * the keyboard's absolute top edge: `windowHeight - screenY`. Under Expo's
 * mandatory edge-to-edge display (SDK 54, Android) the app window is always
 * full-height, and keyboard event metrics are unreliable — depending on the
 * keyboard app and system bar configuration the reported `height` can miss
 * the suggestion/nav zone, leaving the composer slightly covered ("the
 * keyboard eats a bit of the interface") or overshooting. `screenY` is the
 * keyboard's top edge in screen/window coordinates, so this subtraction is
 * exact regardless of how the height is measured; the raw `height` is kept
 * only as a fallback when the subtraction lands at/below zero on platforms
 * where window and screen origins diverge (multi-window, iOS notches).
 */
export function useKeyboardHeight(): number {
  const [padding, setPadding] = useState(0)
  useEffect(() => {
    const showName = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideName = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const show = Keyboard.addListener(showName, (e) => {
      const { height, screenY } = e.endCoordinates
      const byTop = Dimensions.get("window").height - screenY
      setPadding(byTop > 0 ? byTop : Math.max(0, height))
    })
    const hide = Keyboard.addListener(hideName, () => {
      setPadding(0)
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return padding
}
