// Speech recognizers take a BCP-47 language tag. Pass the device locale
// through untouched: Android's ru-RU / zh-CN are valid, and replacing the
// region with -US produced tags no recognizer knows (ru-US, zh-US).
export function speechLocale(locale: string | undefined): string {
  return locale || "en-US"
}
