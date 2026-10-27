import { useCallback, useMemo, useState } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useColorScheme, Linking } from "react-native"
import { Stack, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { MessageBubble, PermissionPrompt } from "../src/components/chat"
import { buildDemoScript, buildDemoCompletionMessage, buildDemoDenialMessage } from "../src/lib/demo-script"
import { SETUP_GUIDE_URL } from "../src/lib/links"
import { type DemoPermissionReply } from "../src/lib/demo-analytics"
import { T } from "../src/theme/tokens"

// Fully offline, scripted walkthrough for installers with no self-hosted
// opencode server. ISOLATION: every message/part below is hardcoded local
// data built once with useMemo — this screen never calls useSessions,
// useConnections, useEvents, or any sdk.ts client method, so it cannot
// create a real session, touch the network, or corrupt real app state. The
// permission "reply" only flips local component state (below); it never
// calls sessionClient.permission.reply the way app/session/[id].tsx does.
export default function DemoScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  // Built once per mount from pure, hardcoded data (src/lib/demo-script.ts).
  const script = useMemo(() => buildDemoScript(), [])
  const [reply, setReply] = useState<DemoPermissionReply | null>(null)

  const handleReply = useCallback((r: DemoPermissionReply) => {
    setReply(r)
  }, [])

  const handleConnectPress = useCallback(() => {
    router.push("/connection/add")
  }, [router])

  const completion = useMemo(() => {
    if (!reply) return null
    return reply === "reject" ? buildDemoDenialMessage() : buildDemoCompletionMessage()
  }, [reply])

  const [userMessage, assistantMessage] = script.messages

  return (
    <>
      <Stack.Screen options={{ title: t("demo.title"), presentation: "card" }} />
      <View style={[s.container, isDark && s.containerDark]} testID="demo-screen">
        <View style={[s.banner, isDark && s.bannerDark]} testID="demo-banner">
          <Ionicons name="play-circle-outline" size={16} color={T.accent} />
          <Text style={s.bannerText}>{t("demo.banner")}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          <MessageBubble message={userMessage} parts={script.parts[userMessage.id] || []} isDark={isDark} />
          <MessageBubble message={assistantMessage} parts={script.parts[assistantMessage.id] || []} isDark={isDark} />

          {!reply && <PermissionPrompt permission={script.permission} isDark={isDark} onReply={handleReply} />}

          {completion && (
            <MessageBubble message={completion.message} parts={completion.parts} isDark={isDark} />
          )}

          <View style={[s.ctaCard, isDark && s.ctaCardDark]} testID="demo-cta-card">
            <Text style={[s.ctaTitle, isDark && s.textWhite]}>{t("demo.ctaTitle")}</Text>
            <Text style={[s.ctaSubtitle, isDark && s.metaDark]}>{t("demo.ctaSubtitle")}</Text>
            <TouchableOpacity
              style={s.connectButton}
              onPress={handleConnectPress}
              testID="demo-connect-button"
            >
              <Text style={s.connectButtonText}>{t("demo.connectButton")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.hostedCtaLink}
              onPress={handleConnectPress}
              testID="demo-hosted-cta"
            >
              <Text style={s.hostedCtaLinkText}>{t("demo.hostedCtaLink")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.setupGuideLink}
              onPress={() => Linking.openURL(SETUP_GUIDE_URL)}
              testID="demo-setup-guide-link"
            >
              <Text style={s.setupGuideLinkText}>{t("demo.setupGuideLink")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper },
  containerDark: { backgroundColor: T.paper },
  textWhite: { fontFamily: T.font, color: T.ink },
  metaDark: { fontFamily: T.font, color: T.muted },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T.accentWash,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  bannerDark: { backgroundColor: T.paper2, borderBottomColor: T.rule },
  bannerText: { fontFamily: T.font, fontSize: 13, fontWeight: "600", color: T.accent, flex: 1 },

  scrollContent: { padding: 16, paddingBottom: 40 },

  ctaCard: {
    marginTop: 8,
    padding: 20,
    borderRadius: T.radius,
    backgroundColor: T.accentWash,
    alignItems: "center",
  },
  ctaCardDark: { backgroundColor: T.accentWash },
  ctaTitle: { fontFamily: T.font, fontSize: 17, fontWeight: "700", color: T.accent, textAlign: "center" },
  ctaSubtitle: { fontFamily: T.font, fontSize: 13, color: T.muted, marginTop: 6, textAlign: "center", lineHeight: 18 },
  connectButton: {
    marginTop: 16,
    backgroundColor: T.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: T.radius,
    width: "100%",
    alignItems: "center",
  },
  connectButtonText: { fontFamily: T.font, color: T.accentInk, fontWeight: "600", fontSize: 15 },
  hostedCtaLink: { marginTop: 14 },
  hostedCtaLinkText: { fontFamily: T.font, fontSize: 14, fontWeight: "600", color: T.accent, textAlign: "center" },
  setupGuideLink: { marginTop: 14 },
  setupGuideLinkText: { fontFamily: T.font, fontSize: 14, fontWeight: "600", color: T.accent },
})
