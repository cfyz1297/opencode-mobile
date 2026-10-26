import { useState } from "react"
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { Markdown } from "../markdown"
import type { Part } from "../../lib/sdk"
import { T } from "../../theme/tokens"

interface Props {
  part: Part
  isDark: boolean
}

// V2 reports compaction as a conversation message rather than a chat part.
// The TUI draws it as a separator + summary block; mirror that here so the
// stored context stays readable instead of vanishing from the transcript.
export function CompactionCard({ part, isDark }: Props) {
  const { t } = useTranslation()
  const failed = part.status === "failed"
  const running = part.status === "running"
  const text = part.text?.trim() ?? ""
  const [expanded, setExpanded] = useState(true)

  const accent = failed ? T.ink : T.accent

  return (
    <View style={s.wrap} testID="chat-compaction">
      <View style={s.dividerRow}>
        <View style={[s.line, isDark && s.lineDark]} />
        <TouchableOpacity
          style={s.header}
          onPress={() => setExpanded((value) => !value)}
          disabled={running || !text}
          accessibilityRole="button"
          accessibilityLabel={t(failed ? "chat.compaction.failed" : "chat.compaction.title")}
        >
          <Ionicons
            name={failed ? "close-circle-outline" : running ? "sync-outline" : "layers-outline"}
            size={14}
            color={accent}
          />
          <Text style={[s.title, { color: accent }]}>
            {t(failed ? "chat.compaction.failed" : running ? "chat.compaction.running" : "chat.compaction.title")}
          </Text>
          {running && <ActivityIndicator size="small" color={accent} />}
          {!running && text.length > 0 && (
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={T.muted}
            />
          )}
        </TouchableOpacity>
        <View style={[s.line, isDark && s.lineDark]} />
      </View>

      {expanded && text.length > 0 && (
        <View style={[s.body, isDark && s.bodyDark]}>{failed ? <Text style={s.error}>{text}</Text> : <Markdown>{text}</Markdown>}</View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginBottom: 16 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: T.paper2 },
  lineDark: { backgroundColor: T.paper3 },
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  title: { fontFamily: T.mono, fontSize: 12, fontWeight: "600" },
  body: {
    marginTop: 8,
    padding: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: T.rule,
    backgroundColor: T.paper2,
  },
  bodyDark: { backgroundColor: T.paper2, borderColor: T.rule },
  error: { fontFamily: T.mono, fontSize: 13, lineHeight: 20, color: T.ink2 },
})
