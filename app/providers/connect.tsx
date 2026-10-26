import { useCallback, useMemo, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
  ActivityIndicator,
} from "react-native"
import { Stack, router, useLocalSearchParams } from "expo-router"
import { useTranslation } from "react-i18next"
import { useConnections } from "../../src/stores/connections"
import { useCatalog } from "../../src/stores/catalog"
import { findPopularProvider } from "../../src/lib/providers-ui"
import {
  resolveConnectDisplayName,
  validateApiKeyInput,
  validateConnectProviderId,
} from "../../src/lib/provider-auth"
import { ApiError, isAuthError } from "../../src/lib/sdk"
import { T } from "../../src/theme/tokens"

export default function ConnectProviderScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()
  const params = useLocalSearchParams<{ id?: string; name?: string }>()
  const idCheck = validateConnectProviderId(typeof params.id === "string" ? params.id : "")
  const providerID = idCheck.ok ? idCheck.id : ""
  const known = providerID ? findPopularProvider(providerID) : undefined
  const displayName = resolveConnectDisplayName(
    providerID || t("providers.connect.unknown"),
    typeof params.name === "string" ? params.name : undefined,
    known?.name,
  )

  const client = useConnections((s) => s.client)
  const loadCatalog = useCatalog((s) => s.load)

  const [apiKey, setApiKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [secureVisible, setSecureVisible] = useState(false)

  const keyCheck = useMemo(() => validateApiKeyInput(apiKey), [apiKey])

  const onSubmit = useCallback(async () => {
    if (!idCheck.ok || !providerID) {
      Alert.alert(
        t("common.error"),
        t(idCheck.ok ? "providers.connect.missingId" : `providers.connect.errors.id_${idCheck.error}`),
      )
      return
    }
    if (!client) {
      Alert.alert(t("common.error"), t("providers.noServer"))
      return
    }
    const checked = validateApiKeyInput(apiKey)
    if (!checked.ok) {
      Alert.alert(t("common.error"), t(`providers.connect.errors.${checked.error}`))
      return
    }

    setBusy(true)
    try {
      await client.provider.connectApiKey(providerID, checked.key)
      setApiKey("")
      await loadCatalog()
      Alert.alert(t("common.ok"), t("providers.connect.success", { name: displayName }), [
        { text: t("common.ok"), onPress: () => router.back() },
      ])
    } catch (error) {
      const message = isAuthError(error)
        ? t("providers.connect.errors.unauthorized")
        : error instanceof ApiError
          ? t("providers.connect.errors.server", { status: error.status })
          : t("providers.connect.errors.unknown")
      Alert.alert(t("common.error"), message)
    } finally {
      setBusy(false)
    }
  }, [apiKey, client, displayName, idCheck, loadCatalog, providerID, t])

  return (
    <>
      <Stack.Screen options={{ title: t("providers.connect.title", { name: displayName }) }} />
      <ScrollView
        style={[styles.container, isDark && styles.containerDark]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="provider-connect-screen"
      >
        <Text style={[styles.lead, isDark && styles.metaDark]}>
          {t("providers.connect.lead", { name: displayName, id: providerID })}
        </Text>
        <Text style={[styles.securityNote, isDark && styles.metaDark]}>{t("providers.connect.securityNote")}</Text>

        <Text style={[styles.label, isDark && styles.metaDark]}>{t("providers.connect.apiKeyLabel")}</Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={t("providers.connect.apiKeyPlaceholder")}
          placeholderTextColor={T.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="password"
          secureTextEntry={!secureVisible}
          editable={!busy}
          testID="provider-connect-key"
        />
        <TouchableOpacity onPress={() => setSecureVisible((v) => !v)} hitSlop={8}>
          <Text style={[styles.toggle, isDark && styles.metaDark]}>
            {secureVisible ? t("providers.connect.hideKey") : t("providers.connect.showKey")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, (!idCheck.ok || !keyCheck.ok || busy || !client) && styles.primaryBtnDisabled]}
          onPress={onSubmit}
          disabled={!idCheck.ok || !keyCheck.ok || busy || !client}
          testID="provider-connect-submit"
        >
          {busy ? (
            <ActivityIndicator color={T.ink} />
          ) : (
            <Text style={styles.primaryBtnText}>{t("providers.connect.submit")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper },
  containerDark: { backgroundColor: T.paper },
  content: { padding: 16, paddingBottom: 40, gap: 10 },
  lead: { fontFamily: T.mono, fontSize: 14, color: T.ink, lineHeight: 20 },
  securityNote: { fontFamily: T.mono, fontSize: 13, color: T.muted, lineHeight: 18, marginBottom: 8 },
  metaDark: { fontFamily: T.mono, color: T.muted },
  label: { fontFamily: T.mono, fontSize: 13, fontWeight: "600", color: T.muted, marginTop: 4 },
  input: {
    backgroundColor: T.paper2,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: T.ink,
  },
  inputDark: { fontFamily: T.mono, backgroundColor: T.paper3, color: T.ink },
  toggle: { fontFamily: T.mono, fontSize: 13, color: T.muted, marginBottom: 8 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: T.accent,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontFamily: T.mono, color: T.accentInk, fontWeight: "700", fontSize: 15 },
})
