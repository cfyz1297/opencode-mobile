import { useCallback, useMemo, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  TextInput,
} from "react-native"
import { Stack, router } from "expo-router"
import { useTranslation } from "react-i18next"
import { useCatalog } from "../../src/stores/catalog"
import { useConnections } from "../../src/stores/connections"
import {
  buildProvidersScreenModel,
  connectHref,
  CUSTOM_PROVIDER_ROUTE,
  type ConnectionBadge,
  type PopularProviderRow,
} from "../../src/lib/providers-ui"
import { T } from "../../src/theme/tokens"

export default function ProvidersScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()
  const providers = useCatalog((s) => s.providers)
  const load = useCatalog((s) => s.load)
  const client = useConnections((s) => s.client)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")

  const screen = useMemo(() => buildProvidersScreenModel(providers, query), [providers, query])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const openConnect = useCallback(
    (row: PopularProviderRow) => {
      if (row.isCustom) {
        router.push(CUSTOM_PROVIDER_ROUTE)
        return
      }
      router.push(connectHref(row.id, row.name))
    },
    [],
  )

  const badgeLabel = useCallback(
    (badge: ConnectionBadge) =>
      badge === "account" ? t("providers.badge.account") : t("providers.badge.apiKey"),
    [t],
  )

  const popularDesc = useCallback(
    (row: PopularProviderRow) =>
      row.descriptionKey === "providers.popular.generic.description"
        ? t(row.descriptionKey, { name: row.name })
        : t(row.descriptionKey),
    [t],
  )

  return (
    <>
      <Stack.Screen options={{ title: t("providers.title") }} />
      <ScrollView
        style={[styles.container, isDark && styles.containerDark]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.ink} />
        }
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

        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>{t("providers.customTitle")}</Text>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={[styles.popularRow, isDark && styles.connectedRowDark, styles.rowLast]}>
            <View style={styles.popularText}>
              <Text style={[styles.providerName, isDark && styles.textDark]}>{t("providers.custom.rowName")}</Text>
              <Text style={[styles.popularDesc, isDark && styles.metaDark]}>{t(screen.custom.descriptionKey)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.connectBtn, isDark && styles.connectBtnDark]}
              onPress={() => openConnect(screen.custom)}
              testID="provider-connect-other"
            >
              <Text style={[styles.connectBtnText, isDark && styles.connectBtnTextDark]}>
                {t("providers.customCta")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
          {t("providers.popularTitle")} ({screen.popular.length})
        </Text>
        <TextInput
          style={[styles.search, isDark && styles.searchDark]}
          placeholder={t("providers.searchPlaceholder")}
          placeholderTextColor={T.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          testID="providers-search"
        />
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
                  <Text style={[styles.popularDesc, isDark && styles.metaDark]}>{popularDesc(row)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.connectBtn, isDark && styles.connectBtnDark]}
                  onPress={() => openConnect(row)}
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
  container: { flex: 1, backgroundColor: T.paper },
  containerDark: { backgroundColor: T.paper },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { fontFamily: T.mono, fontSize: 14, color: T.muted, marginBottom: 20, lineHeight: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: T.muted,


    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitleDark: { fontFamily: T.mono, color: T.muted },
  search: {
    backgroundColor: T.paper2,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: T.ink,
    marginBottom: 10,
    fontFamily: T.mono,
  },
  searchDark: { fontFamily: T.mono, backgroundColor: T.paper3, color: T.ink },
  card: {
    backgroundColor: T.paper2,
    borderRadius: 0,
    marginBottom: 20,
    overflow: "hidden",
  },
  cardDark: { backgroundColor: T.paper2 },
  emptyCard: {
    backgroundColor: T.paper2,
    borderRadius: 0,
    padding: 16,
    marginBottom: 20,
  },
  emptyCardDark: { backgroundColor: T.paper2 },
  emptyText: { fontFamily: T.mono, fontSize: 14, color: T.muted, lineHeight: 20 },
  connectedRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
  },
  connectedRowDark: { borderBottomColor: T.rule },
  rowLast: { borderBottomWidth: 0 },
  connectedMain: { gap: 6 },
  providerName: { fontFamily: T.mono, fontSize: 16, fontWeight: "600", color: T.ink },
  textDark: { fontFamily: T.mono, color: T.ink },
  metaDark: { fontFamily: T.mono, color: T.muted },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: {
    backgroundColor: T.paper2,
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeDark: { backgroundColor: T.paper3 },
  badgeText: { fontFamily: T.mono, fontSize: 11, fontWeight: "600", color: T.muted },
  badgeTextDark: { fontFamily: T.mono, color: T.muted },
  modelCount: { fontFamily: T.mono, fontSize: 12, color: T.muted },
  popularRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
    gap: 12,
  },
  popularText: { flex: 1, gap: 4 },
  popularDesc: { fontFamily: T.mono, fontSize: 13, color: T.muted, lineHeight: 18 },
  connectBtn: {
    backgroundColor: T.accent,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  connectBtnDark: { backgroundColor: T.accent },
  connectBtnText: { fontFamily: T.mono, fontSize: 13, fontWeight: "600", color: T.accentInk },
  connectBtnTextDark: { fontFamily: T.mono, color: T.accentInk },
})
