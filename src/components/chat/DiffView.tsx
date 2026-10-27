import { View, Text, StyleSheet, Platform, ScrollView } from "react-native"
import { WIDE_CONTENT_SCROLL_CONFIG } from "../../lib/scroll-config"
import { computeDiff } from "./diff-compute"
import { T } from "../../theme/tokens"

const mono = Platform.OS === "ios" ? "Menlo" : "monospace"

interface Props {
  before: string
  after: string
  isDark: boolean
}

export function DiffView({ before, after, isDark }: Props) {
  const lines = computeDiff(before, after)

  if (lines.length === 0) return null

  return (
    <View style={[s.container, isDark && s.containerDark]}>
      <ScrollView {...WIDE_CONTENT_SCROLL_CONFIG} testID="diff-view-scroll">
        <View>
          {lines.map((line, idx) => (
            <View
              key={idx}
              style={[
                s.line,
                line.type === "add" && (isDark ? s.addDark : s.add),
                line.type === "remove" && (isDark ? s.removeDark : s.remove),
              ]}
            >
              <Text style={[s.prefix, isDark && s.prefixDark]}>
                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
              </Text>
              <Text
                style={[
                  s.text,
                  isDark && s.textDark,
                  line.type === "add" && s.addText,
                  line.type === "remove" && s.removeText,
                ]}
                selectable
              >
                {line.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    borderRadius: T.radius,
    overflow: "hidden",
    backgroundColor: T.paper2,
    marginTop: 6,
  },
  containerDark: { backgroundColor: T.paper2 },

  line: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  add: { backgroundColor: T.paper2 },
  addDark: { backgroundColor: T.accentWash },
  remove: { backgroundColor: T.paper2 },
  removeDark: { backgroundColor: T.paper2 },

  prefix: {
    width: 16,
    fontSize: 12,
    fontFamily: mono,
    color: T.muted,
    lineHeight: 20,
  },
  prefixDark: { fontFamily: T.mono, color: T.muted },

  text: {
    fontSize: 12,
    fontFamily: mono,
    color: T.ink,
    lineHeight: 20,
  },
  textDark: { fontFamily: T.mono, color: T.ink2 },
  addText: { fontFamily: T.mono, color: T.accent },
  removeText: { fontFamily: T.mono, color: T.ink2 },
})
