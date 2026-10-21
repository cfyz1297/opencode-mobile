// Pure helpers for the question card's answer state. Extracted from
// QuestionPrompt so the custom-answer path can be pinned with plain node
// tests: typed text must stay selected until the reply is confirmed instead
// of being cleared the moment the user taps the send icon.
//
// Answers are stored as displayed labels (one string[] per question), which is
// what QuestionPrompt renders and what the SDK translates back into form
// option values before replying.

/** Trim a custom answer and return it as a single-selection answer, or null when blank. */
export function parseCustomAnswer(value: string): string[] | null {
  const text = value.trim()
  return text ? [text] : null
}

/**
 * Replace the selection for one question while preserving every other answer.
 * Always returns fresh nested arrays so React state updates never alias the
 * previous state (and a later edit cannot mutate an earlier snapshot).
 */
export function applyQuestionAnswer(answers: string[][], index: number, values: string[]): string[][] {
  const copy = answers.map((entry) => [...entry])
  while (copy.length <= index) copy.push([])
  copy[index] = [...values]
  return copy
}
