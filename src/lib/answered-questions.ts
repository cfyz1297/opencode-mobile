// Answered questions stay in the transcript.
//
// V2's form is a one-shot request: once answered, the server drops it and the
// `question.asked` entry is removed from the pending list. The prompt card used
// to vanish with it (a 2.5 s echo was the only reminder), so the user could no
// longer check what they had answered a minute later. Keeping the request and
// the chosen answers in the store lets the card stay where the question was.
export interface AnsweredQuestionRequest {
  id: string
  questions: Array<{ header: string; question: string }>
}

export interface AnsweredQuestion<R extends AnsweredQuestionRequest = AnsweredQuestionRequest> {
  request: R
  answers: string[][]
}

/**
 * Append an answered question to its session's list. Answering the same
 * request twice (retry after a failed reply) replaces the older entry instead
 * of duplicating the card.
 */
export function recordAnswered<R extends AnsweredQuestionRequest>(
  list: readonly AnsweredQuestion<R>[],
  request: R,
  answers: string[][],
): AnsweredQuestion<R>[] {
  const next = list.filter((item) => item.request.id !== request.id)
  next.push({ request, answers: answers.map((entry) => [...entry]) })
  return next
}

/** One-line "Option A · Option B" summary of a multi-question answer. */
export function formatAnswer(answers: readonly string[][]): string {
  return answers
    .flat()
    .map((answer) => answer.trim())
    .filter(Boolean)
    .join(" · ")
}
