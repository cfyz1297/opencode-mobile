import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { formatAnswer } from "../../lib/answered-questions"

interface Question {
  question: string
  header: string
  options: Array<{ label: string; description: string }>
  multiple?: boolean
}

interface Props {
  request: { id: string; questions: Question[] }
  answers: string[][]
  isDark: boolean
}

/**
 * An answered question, kept in the transcript so the user can re-read what
 * they picked at any time. Collapsed to one line by default — several of these
 * must not eat the space above the composer — and expanded on tap to show the
 * full option list with the chosen answers marked.
 */
export function AnsweredQuestionCard({ request, answers, isDark }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const summary = formatAnswer(answers)
  const header = request.questions[0]?.header || t("chat.questionPrompt.headerFallback")

  return (
    <View style={[s.card, isDark && s.cardDark]}>
      <TouchableOpacity
        style={s.summaryRow}
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${t("chat.questionPrompt.answered")}: ${header}`}
        testID={`answered-question-${request.id}`}
      >
        <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
        <View style={s.summaryBody}>
          <Text style={[s.title, isDark && s.textWhite]} numberOfLines={1}>
            {header}
          </Text>
          <Text style={[s.answer, isDark && s.metaDark]} numberOfLines={expanded ? undefined : 2}>
            {summary || t("chat.questionPrompt.dismissed")}
          </Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color="#888888" />
      </TouchableOpacity>

      {expanded &&
        request.questions.map((question, index) => {
          const picked = answers[index] || []
          return (
            <View key={`${question.header}-${index}`} style={s.questionBlock}>
              <Text style={[s.question, isDark && s.textWhite]}>{question.question}</Text>
              {question.options.map((option) => {
                const selected = picked.includes(option.label)
                return (
                  <View key={option.label} style={[s.option, isDark && s.optionDark, selected && s.optionSelected]}>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={16}
                      color={selected ? "#8b5cf6" : isDark ? "#555555" : "#bbbbbb"}
                    />
                    <Text
                      style={[s.optionLabel, isDark && s.textWhite, selected && s.optionLabelSelected]}
                    >
                      {option.label}
                    </Text>
                  </View>
                )
              })}
            </View>
          )
        })}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ede9fe",
  },
  cardDark: { backgroundColor: "#1a1a2e", borderColor: "#2a2a3e" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryBody: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600", color: "#6d28d9" },
  textWhite: { color: "#ffffff" },
  answer: { fontSize: 13, color: "#3f3f46", marginTop: 2 },
  metaDark: { color: "#a1a1aa" },
  questionBlock: { marginTop: 12, gap: 6 },
  question: { fontSize: 13, lineHeight: 19, color: "#0a0a0a" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  optionDark: {},
  optionSelected: { backgroundColor: "rgba(139, 92, 246, 0.15)" },
  optionLabel: { fontSize: 13, color: "#0a0a0a" },
  optionLabelSelected: { color: "#8b5cf6", fontWeight: "600" },
})
