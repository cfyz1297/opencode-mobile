import { useCallback, useMemo, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  Alert,
} from "react-native"
import { Stack } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useCatalog } from "../../src/stores/catalog"
import { useConnections } from "../../src/stores/connections"
import { buildProvidersScreenModel, type ConnectionBadge } from "../../src/lib/providers-ui"

export default function ProvidersScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()
  const providers = useCatalog((s) => s.providers)
  const load = useCatalog((s) => s.load)
  const client = useConnections((s) => s.client)
  const [refreshing, setRefreshing] = useState(false)

  const screen = useMemo(() => buildProvidersScreenModel(providers), [providers])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const showConnectHelp = useCallback(
    (name: string) => {
      Alert.alert(
        t("providers.connectTitle", { name }),
        t("providers.connectBody"),
        [{ text: t("common.ok") }],
      )
    },
    [t],
  )

  const badgeLabel = useCallback(
    (badge: ConnectionBadge) =>
      badge === "account" ? t("providers.badge.account") : t("providers.badge.apiKey"),
    [t],
  )

  return (
    <>
      <Stack.Screen options={{ title: t("providers.title") }} />
      <ScrollView
        style={[styles.container, isDark && styles.containerDark]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? "#fff" : "#0a0a0a"} />}
        testID="providers-screen"
      >
        <Text style={[styles.subtitle, isDark && styles.metaDark]}>{t("providers.subtitle")}</Text>

        {!client && (
          <View style={[styles.emptyCard, isDark && styles.emptyCardDark]}>
            <Text style={[styles.emptyText, isDark && styles.metaDark]}>{t("providers.noServer")}</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>{t("providers.connectedTitle")}</Text>
        {screen.connected.length === 0 ? (
          <View style={[styles.emptyCard, isDark && styles.emptyCardDark]}>
            <Text style={[styles.emptyText, isDark && styles.metaDark]}>{t("providers.connectedEmpty")}</Text>
          </View>
        ) : (
          <View style={[styles.card, isDark && styles.cardDark]}>
            {screen.connected.map((row, index) => (
              <View
                key={row.id}
                style={[
                  styles.connectedRow,
                  isDark && styles.connectedRowDark,
                  index === screen.connected.length - 1 && styles.rowLast,
                ]}
                testID={`provider-connected-${row.id}`}
              >
                <View style={styles.connectedMain}>
                  <Text style={[styles.providerName, isDark && styles.textDark]}>{row.name}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, isDark && styles.badgeDark]}>
                      <Text style={[styles.badgeText, isDark && styles.badgeTextDark]}>{badgeLabel(row.badge)}</Text>
                    </View>
                    <Text style={[styles.modelCount, isDark && styles.metaDark]}>
                      {t("providers.modelsAvailable", { count: row.modelCount })}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>{t("providers.popularTitle")}</Text>
        {screen.popular.length === 0 ? (
          <View style={[styles.emptyCard, isDark && styles.emptyCardDark]}>
            <Text style={[styles.emptyText, isDark && styles.metaDark]}>{t("providers.popularEmpty")}</Text>
          </View>
        ) : (
          <View style={[styles.card, isDark && styles.cardDark]}>
            {screen.popular.map((row, index) => (
              <View
                key={row.id}
                style={[
                  styles.popularRow,
                  isDark && styles.connectedRowDark,
                  index === screen.popular.length - 1 && styles.rowLast,
                ]}
                testID={`provider-popular-${row.id}`}
              >
                <View style={styles.popularText}>
                  <Text style={[styles.providerName, isDark && styles.textDark]}>{row.name}</Text>
                  <Text style={[styles.popularDesc, isDark && styles.metaDark]}>{t(row.descriptionKey)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.connectBtn, isDark && styles.connectBtnDark]}
                  onPress={() => showConnectHelp(row.name)}
                  testID={`provider-connect-${row.id}`}
                >
                  <Text style={[styles.connectBtnText, isDark && styles.connectBtnTextDark]}>
                    {t("providers.connectCta")}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  containerDark: { backgroundColor: "#0a0a0a" },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { fontSize: 14, color: "#666666", marginBottom: 20, lineHeight: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitleDark: { color: "#999999" },
  card: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  cardDark: { backgroundColor: "#1a1a1a" },
  emptyCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  emptyCardDark: { backgroundColor: "#1a1a1a" },
  emptyText: { fontSize: 14, color: "#666666", lineHeight: 20 },
  connectedRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  connectedRowDark: { borderBottomColor: "#2a2a2a" },
  rowLast: { borderBottomWidth: 0 },
  connectedMain: { gap: 6 },
  providerName: { fontSize: 16, fontWeight: "600", color: "#0a0a0a" },
  textDark: { color: "#ffffff" },
  metaDark: { color: "#888888" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: {
    backgroundColor: "#e8e8e8",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeDark: { backgroundColor: "#2a2a2a" },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#555555" },
  badgeTextDark: { color: "#bbbbbb" },
  modelCount: { fontSize: 12, color: "#888888" },
  popularRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
    gap: 12,
  },
  popularText: { flex: 1, gap: 4 },
  popularDesc: { fontSize: 13, color: "#666666", lineHeight: 18 },
  connectBtn: {
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  connectBtnDark: { backgroundColor: "#ffffff" },
  connectBtnText: { fontSize: 13, fontWeight: "600", color: "#ffffff" },
  connectBtnTextDark: { color: "#0a0a0a" },
})
