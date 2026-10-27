import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { applyQuestionAnswer, parseCustomAnswer } from "../../lib/question-answers"
import { T } from "../../theme/tokens"

interface QuestionOption {
  label: string
  description: string
}

interface Question {
  question: string
  header: string
  options: QuestionOption[]
  multiple?: boolean
  custom?: boolean
}

interface Props {
  request: {
    id: string
    questions: Question[]
  }
  isDark: boolean
  onReply: (answers: string[][]) => void | Promise<void>
  onReject: () => void | Promise<void>
}

type ReplyStatus = "idle" | "sending" | "sent" | "error"

export function QuestionPrompt({ request, isDark, onReply, onReject }: Props) {
  const { t } = useTranslation()
  const [answers, setAnswers] = useState<string[][]>(request.questions.map(() => []))
  const answersRef = useRef(answers)
  const commitAnswers = (next: string[][]) => {
    answersRef.current = next
    setAnswers(next)
  }
  const [custom, setCustom] = useState("")
  const [showCustom, setShowCustom] = useState(false)
  const [current, setCurrent] = useState(0)
  const [status, setStatus] = useState<ReplyStatus>("idle")

  // A question is answered exactly once. Without this guard, a double-tap on a
  // single-select option schedules two `onReply` timers; the second reply hits
  // an already-resolved request server-side and surfaces a spurious
  // "Reply failed" alert even though the answer went through.
  const replied = useRef(false)
  const lastRequestId = useRef<string | null>(null)

  // BUG-019: if the server rejects our reply (network error), the prompt stays
  // mounted with the same request ID — clear the guard and let the user retry.
  useEffect(() => {
    if (lastRequestId.current !== request.id) {
      lastRequestId.current = request.id
      replied.current = false
      setStatus("idle")
      const empty = request.questions.map(() => [])
      answersRef.current = empty
      setAnswers(empty)
      setCustom("")
      setShowCustom(false)
      setCurrent(0)
    }
  }, [request.id])

  const busy = status === "sending" || status === "sent"

  const reply = async (next: string[][]) => {
    if (replied.current) return
    replied.current = true
    setStatus("sending")
    try {
      await onReply(next)
      setStatus("sent")
    } catch {
      // The screen already showed the failure alert; keep the card mounted so
      // the answer and the retry path stay visible.
      replied.current = false
      setStatus("error")
    }
  }

  const reject = async () => {
    if (replied.current) return
    replied.current = true
    try {
      await onReject()
    } catch {
      // The screen already alerted; allow retry with the same request ID.
      replied.current = false
    }
  }

  const q = request.questions[current]
  if (!q) return null

  const customApplied =
    custom.trim().length > 0 &&
    (answers[current] || []).length === 1 &&
    answers[current][0] === custom.trim()

  const toggleOption = (label: string) => {
    if (busy) return
    setStatus("idle")
    const selected = answersRef.current[current] || []
    const values = q.multiple
      ? selected.includes(label)
        ? selected.filter((a) => a !== label)
        : [...selected, label]
      : [label]
    const next = applyQuestionAnswer(answersRef.current, current, values)
    commitAnswers(next)
    if (!q.multiple && request.questions.length === 1) {
      // Reply immediately: waiting left a window where a second tap could
      // change the visible selection after the first answer was queued.
      void reply(next)
    }
  }

  const submitCustom = () => {
    if (busy) return
    const values = parseCustomAnswer(custom)
    if (!values) return
    setStatus("idle")
    const next = applyQuestionAnswer(answersRef.current, current, values)
    commitAnswers(next)
    // Keep the typed text visible: the user must be able to see what they
    // answered. Clearing it here was the "my answer disappeared" bug.
    if (request.questions.length === 1) {
      void reply(next)
    }
  }

  const goNextOrSubmit = () => {
    if (busy) return
    if (current < request.questions.length - 1) {
      setCurrent(current + 1)
      setCustom("")
      setShowCustom(false)
      setStatus("idle")
    } else {
      void reply(answersRef.current)
    }
  }

  return (
    <View style={[s.card, isDark && s.cardDark]}>
      <View style={s.header}>
        <Ionicons name="chatbubble-ellipses-outline" size={18} color={T.accent} />
        <Text style={[s.title, isDark && s.textWhite]}>{q.header || t("chat.questionPrompt.headerFallback")}</Text>
      </View>
      <Text style={[s.question, isDark && s.textWhite]}>{q.question}</Text>

      <View style={s.options}>
        {q.options.map((opt) => {
          const selected = (answers[current] || []).includes(opt.label)
          return (
            <TouchableOpacity
              key={opt.label}
              style={[
                s.option,
                isDark && s.optionDark,
                selected && s.optionSelected,
                selected && isDark && s.optionSelectedDark,
                busy && s.optionBusy,
              ]}
              onPress={() => toggleOption(opt.label)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: busy }}
            >
              <Text style={[s.optionLabel, isDark && s.textWhite, selected && s.optionLabelSelected]}>{opt.label}</Text>
              {opt.description ? <Text style={[s.optionDesc, isDark && s.metaDark]}>{opt.description}</Text> : null}
            </TouchableOpacity>
          )
        })}

        {q.custom !== false &&
          (showCustom ? (
            <View style={s.customRow}>
              <TextInput
                style={[s.customInput, isDark && s.customInputDark, busy && s.customInputBusy]}
                placeholder={t("chat.questionPrompt.answerPlaceholder")}
                placeholderTextColor={T.muted}
                value={custom}
                onChangeText={(text) => {
                  if (busy) return
                  setCustom(text)
                  setStatus("idle")
                }}
                onSubmitEditing={submitCustom}
                editable={!busy}
                autoFocus
                accessibilityLabel={t("chat.questionPrompt.customAnswerLabel")}
              />
              <TouchableOpacity
                onPress={submitCustom}
                style={s.customSubmit}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t("chat.questionPrompt.useCustomAnswer")}
                accessibilityState={{ disabled: busy }}
              >
                {busy || customApplied ? (
                  <Ionicons name="checkmark-circle" size={22} color={T.accent} />
                ) : (
                  <Ionicons name="checkmark" size={20} color={T.accent} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.option, isDark && s.optionDark, busy && s.optionBusy]}
              onPress={() => setShowCustom(true)}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={[s.optionLabel, { color: T.accent }]}>{t("chat.questionPrompt.customAnswerLabel")}</Text>
            </TouchableOpacity>
          ))}
      </View>

      <View style={s.footer}>
        <TouchableOpacity onPress={reject} disabled={busy} accessibilityRole="button">
          <Text style={[s.dismiss, isDark && s.metaDark, busy && s.dismissBusy]}>{t("chat.questionPrompt.dismiss")}</Text>
        </TouchableOpacity>
        {(request.questions.length > 1 || q.multiple) && (
          <TouchableOpacity
            style={[s.submitBtn, isDark && s.submitBtnDark, busy && s.submitBtnBusy]}
            onPress={goNextOrSubmit}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
          >
            <Text style={s.submitText}>
              {current < request.questions.length - 1
                ? t("chat.questionPrompt.next")
                : t("chat.questionPrompt.submit")}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {status !== "idle" && (
        <View style={s.statusRow} accessibilityLiveRegion="polite">
          {status === "sending" ? <ActivityIndicator size="small" color={T.accent} /> : null}
          {status === "sent" ? <Ionicons name="checkmark-circle" size={16} color={T.accent} /> : null}
          {status === "error" ? <Ionicons name="alert-circle" size={16} color={T.ink2} /> : null}
          <Text style={[s.statusText, status === "error" && s.statusError, isDark && status !== "error" && s.statusTextDark]}>
            {status === "sending"
              ? t("chat.questionPrompt.sending")
              : status === "sent"
                ? t("chat.questionPrompt.sent")
                : t("chat.questionPrompt.sendFailed")}
          </Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    margin: 12,
    padding: 16,
    backgroundColor: T.accentWash,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.rule,
  },
  cardDark: { backgroundColor: T.accentWash, borderColor: T.rule },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { fontFamily: T.font, fontSize: 15, fontWeight: "600", color: T.accent },
  textWhite: { fontFamily: T.font, color: T.ink },
  question: { fontFamily: T.font, fontSize: 14, lineHeight: 20, color: T.ink, marginBottom: 12 },
  metaDark: { fontFamily: T.font, color: T.muted },

  options: { gap: 8 },
  option: {
    padding: 12,
    borderRadius: T.radiusSm,
    backgroundColor: T.paper2,
    borderWidth: 1,
    borderColor: T.rule,
  },
  optionDark: { backgroundColor: T.paper3, borderColor: T.rule },
  optionSelected: { borderColor: T.accent, backgroundColor: T.accentWash },
  optionSelectedDark: { borderColor: T.accent, backgroundColor: T.accentWash },
  optionBusy: { opacity: 0.7 },
  optionLabel: { fontFamily: T.font, fontSize: 14, fontWeight: "600", color: T.ink },
  optionLabelSelected: { fontFamily: T.font, color: T.accent },
  optionDesc: { fontFamily: T.font, fontSize: 12, color: T.muted, marginTop: 2 },

  customRow: { flexDirection: "row", gap: 8 },
  customInput: {
    flex: 1,
    backgroundColor: T.paper,
    borderRadius: T.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: T.rule,
    color: T.ink,
  },
  customInputDark: { fontFamily: T.font, backgroundColor: T.paper3, borderColor: T.rule, color: T.ink },
  customInputBusy: { borderColor: T.accent },
  customSubmit: { justifyContent: "center", alignItems: "center", padding: 8 },

  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  dismiss: { fontFamily: T.font, fontSize: 14, color: T.muted },
  dismissBusy: { opacity: 0.4 },
  submitBtn: { backgroundColor: T.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: T.radiusSm },
  submitBtnDark: { backgroundColor: T.accent },
  submitBtnBusy: { opacity: 0.6 },
  submitText: { fontFamily: T.font, color: T.accentInk, fontWeight: "600", fontSize: 14 },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  statusText: { fontFamily: T.font, fontSize: 12, color: T.accent },
  statusTextDark: { fontFamily: T.font, color: T.accent },
  statusError: { fontFamily: T.font, color: T.ink2 },
})
