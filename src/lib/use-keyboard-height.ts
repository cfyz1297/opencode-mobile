import { useEffect, useState } from "react"
import { Keyboard, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { keyboardPadding } from "./keyboard-inset"

/**
 * Bottom padding (px) needed to lift content exactly above the soft keyboard
 * — 0 when the keyboard is hidden.
 *
 * Derived from the keyboard event's `height` plus the bottom safe-area inset
 * (see keyboard-inset.ts for why the raw height alone undershoots under
 * edge-to-edge).
 */
export function useKeyboardHeight(): number {
  const insets = useSafeAreaInsets()
  const [padding, setPadding] = useState(0)
  useEffect(() => {
    const showName = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideName = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const show = Keyboard.addListener(showName, (e) => {
      setPadding(keyboardPadding(e.endCoordinates.height, insets.bottom))
    })
    const hide = Keyboard.addListener(hideName, () => {
      setPadding(0)
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [insets.bottom])
  return padding
}
