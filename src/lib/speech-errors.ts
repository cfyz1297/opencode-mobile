/** Whether a native speech-recognition error should surface to the user. */
export function shouldSurfaceSpeechError(options: {
  errorCode?: string
  userStarted: boolean
}): boolean {
  if (options.errorCode === 'no-speech') return false
  // Emulators often emit permission/module errors when the recognition
  // package loads, even if the user never tapped the mic.
  return options.userStarted
}
