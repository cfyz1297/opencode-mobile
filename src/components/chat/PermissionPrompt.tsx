import { useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { T } from "../../theme/tokens"

interface Props {
  permission: { id: string; permission: string; patterns: string[] }
  isDark: boolean
  onReply: (reply: "once" | "always" | "reject") => void
}

export function PermissionPrompt({ permission, isDark, onReply }: Props) {
  const { t } = useTranslation()
  // BUG-023: guard against double-tap — optimistic removal is async, a second
  // tap before the reply lands would send a duplicate request.
  const replied = useRef(false)
  const handleReply = (reply: "once" | "always" | "reject") => {
    if (replied.current) return
    replied.current = true
    onReply(reply)
  }
  return (
    <View style={[s.card, isDark && s.cardDark]}>
      <View style={s.header}>
        <Ionicons name="shield-outline" size={18} color={T.ink2} />
        <Text style={[s.title, isDark && s.textWhite]}>{t("chat.permissionPrompt.title")}</Text>
      </View>
      <Text style={[s.type, isDark && s.typeDark]}>
        {permission.permission}: {permission.patterns.join(", ")}
      </Text>
      <View style={s.actions}>
        <TouchableOpacity style={[s.btn, s.deny]} onPress={() => handleReply("reject")}>
          <Text style={s.denyText}>{t("chat.permissionPrompt.deny")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.always, isDark && s.alwaysDark]} onPress={() => handleReply("always")}>
          <Text style={[s.alwaysText, isDark && s.textWhite]}>{t("chat.permissionPrompt.always")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.allow, isDark && s.allowDark]} onPress={() => handleReply("once")}>
          <Text style={[s.allowText, isDark && s.allowTextDark]}>{t("chat.permissionPrompt.allow")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    margin: 12,
    padding: 16,
    backgroundColor: T.paper2,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.rule,
  },
  cardDark: { backgroundColor: T.paper2, borderColor: T.rule },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { fontFamily: T.font, fontSize: 15, fontWeight: "600", color: T.ink },
  textWhite: { fontFamily: T.font, color: T.ink },
  type: { fontFamily: T.font, fontSize: 13, color: T.ink, marginBottom: 12 },
  typeDark: { fontFamily: T.font, color: T.ink },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: T.radiusSm, alignItems: "center" },
  deny: { backgroundColor: T.paper3 },
  denyText: { fontFamily: T.font, color: T.ink2, fontWeight: "600", fontSize: 14 },
  always: { borderWidth: 1, borderColor: T.rule2 },
  alwaysDark: { borderWidth: 1, borderColor: T.rule2 },
  alwaysText: { fontFamily: T.font, color: T.ink, fontWeight: "600", fontSize: 14 },
  allow: { backgroundColor: T.accent },
  allowDark: { backgroundColor: T.accent },
  allowText: { fontFamily: T.font, color: T.accentInk, fontWeight: "600", fontSize: 14 },
  allowTextDark: { fontFamily: T.font, color: T.accentInk },
})
