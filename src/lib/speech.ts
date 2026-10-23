import { useState, useCallback, useRef, useEffect } from "react"
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition"

interface SpeechState {
  listening: boolean
  transcript: string
  error: string | null
}

interface SpeechActions {
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
}

export function useSpeech(onResult: (text: string) => void): SpeechState & SpeechActions {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const pending = useRef("")

  useSpeechRecognitionEvent("start", () => {
    setListening(true)
    setError(null)
    setTranscript("")
    pending.current = ""
  })

  useSpeechRecognitionEvent("end", () => {
    setListening(false)
    // Deliver final transcript
    if (pending.current.trim()) {
      onResult(pending.current.trim())
    }
    setTranscript("")
    pending.current = ""
  })

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript || ""
    pending.current = text
    setTranscript(text)
  })

  useSpeechRecognitionEvent("error", (event) => {
    // "no-speech" is not really an error — user just didn't say anything
    if (event.error === "no-speech") {
      setListening(false)
      return
    }
    setError(event.message || event.error)
    setListening(false)
  })

  const start = useCallback(async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!result.granted) {
      setError("Microphone permission denied")
      return
    }
    // BUG-024: use device locale instead of hardcoded en-US; await start() so
    // permission/start errors surface as setError instead of unhandled rejection.
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.split("-")[0] || "en"
    try {
      await ExpoSpeechRecognitionModule.start({ lang: `${locale}-US`, interimResults: true, continuous: true })
    } catch (err: any) {
      setError(err?.message || "Failed to start speech recognition")
    }
  }, [])

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop()
  }, [])

  const cancel = useCallback(() => {
    pending.current = ""
    ExpoSpeechRecognitionModule.abort()
    setListening(false)
    setTranscript("")
  }, [])

  // Stop the native recognition session when the screen unmounts — otherwise
  // the mic stays hot in the background. abort() is a no-op when not listening.
  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.abort()
    }
  }, [])

  return { listening, transcript, error, start, stop, cancel }
}
