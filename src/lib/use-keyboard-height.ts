import { useEffect, useState } from "react"
import { DeviceEventEmitter, Keyboard, Platform } from "react-native"
import { keyboardPadding, type KeyboardSignal } from "./keyboard-inset"

/**
 * Bottom padding (dp) needed to lift content exactly above the soft keyboard
 * — 0 when the keyboard is hidden.
 *
 * Android uses the `imeInset` event emitted by MainActivity: React Native's
 * `keyboardDidShow`/`keyboardDidHide` never fire in this app, because the
 * bridgeless root view (`ReactSurfaceView`) has no `ReactInstanceManager` and
 * React Native's global-layout listener bails out before dispatching them.
 * With edge-to-edge the window does not resize for the IME either, so this
 * event is the only way to know the keyboard is open.
 */
export function useKeyboardHeight(): number {
  const [padding, setPadding] = useState(0)
  useEffect(() => {
    if (Platform.OS === "android") {
      const sub = DeviceEventEmitter.addListener("imeInset", (event: KeyboardSignal) => {
        setPadding(keyboardPadding(event))
      })
      return () => sub.remove()
    }
    const show = Keyboard.addListener("keyboardWillShow", (event) => setPadding(keyboardPadding(event)))
    const hide = Keyboard.addListener("keyboardWillHide", () => setPadding(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return padding
}
