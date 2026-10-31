import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

interface Props {
  text: string
  isDark: boolean
  // Reasoning parts carry their own timing; without it the row still reads
  // "Thought" and simply omits the duration.
  time?: { start?: number; end?: number }
}

function seconds(time?: { start?: number; end?: number }): number | null {
  if (!time?.start || !time?.end) return null
  return Math.max(1, Math.round((time.end - time.start) / 1000))
}

// One-line "Thought for 9s" row with the first couple of lines of the
// reasoning visible, the rest behind a tap. Keeping a preview means the user
// can follow the model's train of thought without expanding every step.
export function ReasoningBlock({ text, isDark, time }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const elapsed = seconds(time)

  return (
    <TouchableOpacity style={s.block} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
      <View style={s.header}>
        <Ionicons name="bulb-outline" size={13} color={isDark ? "#a16207" : "#b45309"} />
        <Text style={[s.label, isDark && s.labelDark]}>
          {elapsed ? t("chat.reasoningBlock.thought", { seconds: elapsed }) : t("chat.reasoningBlock.label")}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={13}
          color={isDark ? "#555555" : "#aaaaaa"}
        />
      </View>
      <Text style={[s.text, isDark && s.textDark]} numberOfLines={expanded ? undefined : 2}>
        {text}
      </Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  block: { marginTop: 2, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3 },
  label: { fontSize: 12, fontWeight: "600", color: "#b45309", flex: 1 },
  labelDark: { color: "#a16207" },
  text: { fontSize: 13, lineHeight: 19, color: "#7c5a2a", marginTop: 2, paddingLeft: 18 },
  textDark: { color: "#8a7355" },
})
