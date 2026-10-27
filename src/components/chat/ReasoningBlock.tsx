import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { T } from "../../theme/tokens"

interface Props {
  text: string
  isDark: boolean
}

export function ReasoningBlock({ text, isDark }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <TouchableOpacity
      style={[s.block, isDark && s.blockDark]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={s.header}>
        <Ionicons name="sparkles-outline" size={14} color={T.ink2} />
        <Text style={[s.label, isDark && s.labelDark]}>{t("chat.reasoningBlock.label")}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={T.muted} />
      </View>
      {expanded && (
        <Text style={[s.text, isDark && s.textDark]} selectable>
          {text}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  block: {
    backgroundColor: T.paper,
    borderRadius: T.radiusSm,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T.rule,
  },
  blockDark: { backgroundColor: T.paper, borderColor: T.rule },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontFamily: T.font, fontSize: 12, fontWeight: "600", color: T.ink, flex: 1 },
  labelDark: { fontFamily: T.font, color: T.ink2 },
  text: { fontFamily: T.font, fontSize: 13, lineHeight: 20, color: T.ink2, marginTop: 8 },
  textDark: { fontFamily: T.font, color: T.ink },
})
