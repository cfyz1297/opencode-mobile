import { useEffect, useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useKeyboardHeight } from "../../src/lib/use-keyboard-height"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useConnections } from "../../src/stores/connections"
import { useEvents } from "../../src/stores/events"
import type { ConnectionType } from "../../src/lib/types"
import { probeConnection, shareReport } from "../../src/lib/diagnostics"
import { parseUrl } from "../../src/lib/diagnostics-classify"
import { buildAuth } from "../../src/lib/auth"
import { sendsPasswordInClearText } from "../../src/lib/connection-security"
import { T } from "../../src/theme/tokens"

// labelKey (not literal text): this is a module-level constant evaluated
// before i18next is guaranteed ready, so the label is resolved with t() at
// render time — same pattern as categoryMeta in src/lib/notifications.ts.
const CONNECTION_TYPES: Array<{
  type: ConnectionType
  labelKey: string
  icon: keyof typeof Ionicons.glyphMap
}> = [
  { type: "local", labelKey: "connection.shared.types.local", icon: "wifi" },
  { type: "tunnel", labelKey: "connection.shared.types.tunnel", icon: "globe" },
  { type: "cloud", labelKey: "connection.shared.types.cloud", icon: "cloud" },
]

export default function EditConnectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  // Exact keyboard avoidance (edge-to-edge): see use-keyboard-height.
  const kbHeight = useKeyboardHeight()

  const { connections, updateConnection, removeConnection, testConnection } = useConnections()

  const connection = connections.find((c) => c.id === id)

  const [type, setType] = useState<ConnectionType>(connection?.type || "local")
  const [name, setName] = useState(connection?.name || "")
  const [url, setUrl] = useState(connection?.url || "")
  const [directory, setDirectory] = useState(connection?.directory || "")
  const [username, setUsername] = useState(connection?.username || "")
  const [password, setPassword] = useState("")
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (connection) {
      setType(connection.type)
      setName(connection.name)
      setUrl(connection.url)
      setDirectory(connection.directory || "")
      setUsername(connection.username || "")
    }
  }, [connection])

  if (!connection) {
    return (
      <View style={[styles.container, isDark && styles.containerDark, styles.center]}>
        <Text style={[styles.errorText, isDark && styles.textDark]}>{t("connection.edit.notFound")}</Text>
      </View>
    )
  }

  const handleTest = async () => {
    if (!url.trim()) {
      Alert.alert(t("common.error"), t("connection.shared.alerts.enterUrl"))
      return
    }
    if (!parseUrl(url).valid) {
      Alert.alert(t("connection.shared.alerts.invalidUrlTitle"), t("connection.shared.alerts.invalidUrlMessage"))
      return
    }

    setIsTesting(true)
    const result = await testConnection(
      {
        id: connection.id,
        name: name || "Test",
        type,
        url: url.trim(),
        directory: directory.trim() || undefined,
        username: username.trim() || undefined,
      },
      "edit_test",
      password || undefined,
    )

    if (result.ok) {
      setIsTesting(false)
      Alert.alert(t("connection.edit.alerts.successTitle"), t("connection.edit.alerts.successMessage"))
      return
    }

    // Failed: run active diagnostics and offer a shareable report.
    const report = await probeConnection(url.trim(), buildAuth(username, password))
    setIsTesting(false)

    Alert.alert(
      t("connection.shared.alerts.connectionFailedTitle"),
      t("connection.edit.alerts.connectionFailedMessage", {
        summary: report.summary,
        detail: result.error || t("connection.edit.alerts.noDetail"),
      }),
      [
        { text: t("common.ok"), style: "cancel" },
        { text: t("common.shareReport"), onPress: () => shareReport(report) },
      ],
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("common.error"), t("connection.shared.alerts.enterName"))
      return
    }
    if (!url.trim()) {
      Alert.alert(t("common.error"), t("connection.shared.alerts.enterUrl"))
      return
    }
    if (!parseUrl(url).valid) {
      Alert.alert(t("connection.shared.alerts.invalidUrlTitle"), t("connection.shared.alerts.invalidUrlMessage"))
      return
    }

    setIsSaving(true)
    try {
      await updateConnection(
        connection.id,
        {
          name: name.trim(),
          type,
          url: url.trim(),
          directory: directory.trim() || undefined,
          username: username.trim() || undefined,
        },
        // Empty = keep existing password (the field loads blank); a typed value
        // rotates it in SecureStore.
        password || undefined,
      )
      // If this was the active connection, the SSE loop may have stopped
      // retrying after a prior 401 (see events.ts) — reconnect now with the
      // freshly saved credentials instead of leaving the user stuck until
      // they relaunch the app.
      if (useConnections.getState().activeConnection?.id === connection.id) {
        useEvents.getState().connect()
      }
      setIsSaving(false)
      router.back()
    } catch {
      setIsSaving(false)
      Alert.alert(
        t("connection.shared.alerts.saveFailedTitle"),
        t("connection.shared.alerts.saveFailedMessage"),
      )
    }
  }

  const handleDelete = () => {
    Alert.alert(t("connection.edit.alerts.deleteTitle"), t("connection.edit.alerts.deleteMessage", { name: connection.name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await removeConnection(connection.id)
          router.back()
        },
      },
    ])
  }

  return (
    <View style={{ flex: 1, paddingBottom: kbHeight }}>
    <ScrollView
      style={[styles.container, isDark && styles.containerDark]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Connection Type */}
      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.connectionType")}</Text>
      <View style={styles.typeContainer}>
        {CONNECTION_TYPES.map((opt) => (
          <TouchableOpacity
            key={opt.type}
            style={[
              styles.typeOption,
              isDark && styles.typeOptionDark,
              type === opt.type && styles.typeOptionSelected,
              type === opt.type && isDark && styles.typeOptionSelectedDark,
            ]}
            onPress={() => setType(opt.type)}
          >
            <Ionicons
              name={opt.icon}
              size={20}
              color={type === opt.type ? (T.ink) : T.muted}
            />
            <Text
              style={[
                styles.typeLabel,
                isDark && styles.textDark,
                type === opt.type && styles.typeLabelSelected,
                type === opt.type && isDark && styles.typeLabelSelectedDark,
              ]}
            >
              {t(opt.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Name */}
      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.name")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder={t("connection.shared.namePlaceholder")}
        placeholderTextColor={T.muted}
        value={name}
        onChangeText={setName}
      />

      {/* URL */}
      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.serverUrl")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder="http://192.168.1.100:4096"
        placeholderTextColor={T.muted}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      {/* Directory */}
      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.directoryOptional")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder="/path/to/project"
        placeholderTextColor={T.muted}
        value={directory}
        onChangeText={setDirectory}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={[styles.hint, isDark && styles.hintDark]}>{t("connection.edit.directoryHint")}</Text>

      {/* Auth */}
      <Text style={[styles.sectionTitle, isDark && styles.textDark]}>{t("connection.shared.authentication")}</Text>

      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.shared.username")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder="admin"
        placeholderTextColor={T.muted}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, isDark && styles.labelDark]}>{t("connection.edit.passwordLabel")}</Text>
      <TextInput
        style={[styles.input, isDark && styles.inputDark]}
        placeholder="••••••••"
        placeholderTextColor={T.muted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {sendsPasswordInClearText(url) && (
        <Text style={[styles.securityHint, isDark && styles.securityHintDark]}>
          {t("connection.security.cleartext")}
        </Text>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.testButton, isDark && styles.testButtonDark]}
          onPress={handleTest}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator size="small" color={T.ink} />
          ) : (
            <>
              <Ionicons name="pulse" size={20} color={T.ink} />
              <Text style={[styles.testButtonText, isDark && styles.textDark]}>{t("connection.edit.testButton")}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, isDark && styles.saveButtonDark]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={T.ink} />
          ) : (
            <Text style={[styles.saveButtonText, isDark && styles.saveButtonTextDark]}>
              {t("connection.edit.saveButton")}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={T.ink2} />
          <Text style={styles.deleteButtonText}>{t("connection.edit.deleteButton")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.paper,
  },
  containerDark: {
    backgroundColor: T.paper,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  errorText: {
    fontSize: 16,
    color: T.muted,
    fontFamily: T.mono,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: T.ink,
    marginTop: 16,
    marginBottom: 8,
    fontFamily: T.mono,
  },
  labelDark: {
    color: T.ink,
    fontFamily: T.mono,
  },
  typeContainer: {
    flexDirection: "row",
    gap: 8,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 0,
    backgroundColor: T.accentWash,
    gap: 6,
  },
  typeOptionDark: {
    backgroundColor: T.paper2,
  },
  typeOptionSelected: {
    backgroundColor: T.paper,
  },
  typeOptionSelectedDark: {
    backgroundColor: T.paper,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: T.muted,
    fontFamily: T.mono,
  },
  textDark: {
    color: T.ink,
    fontFamily: T.mono,
  },
  typeLabelSelected: {
    color: T.ink,
    fontFamily: T.mono,
  },
  typeLabelSelectedDark: {
    color: T.ink,
    fontFamily: T.mono,
  },
  input: {
    backgroundColor: T.paper2,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: T.ink,
    fontFamily: T.mono,
  },
  inputDark: {
    backgroundColor: T.paper2,
    color: T.ink,
    fontFamily: T.mono,
  },
  hint: {
    fontSize: 13,
    color: T.muted,
    marginTop: 6,
    fontFamily: T.mono,
  },
  hintDark: {
    color: T.muted,
    fontFamily: T.mono,
  },
  securityHint: {
    fontSize: 13,
    color: T.ink2,
    marginTop: 8,
    fontFamily: T.mono,
  },
  securityHintDark: {
    color: T.ink2,
    fontFamily: T.mono,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: T.ink,
    marginTop: 32,
    marginBottom: 8,
    fontFamily: T.mono,
  },
  actions: {
    marginTop: 32,
    gap: 12,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: T.rule,
  },
  testButtonDark: {
    borderColor: T.rule,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.mono,
  },
  saveButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 0,
    backgroundColor: T.accent,
  },
  saveButtonDark: {
    backgroundColor: T.accent,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: T.accentInk,
    fontFamily: T.mono,
  },
  saveButtonTextDark: {
    color: T.accentInk,
    fontFamily: T.mono,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 0,
    backgroundColor: T.accentWash,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: T.ink2,
    fontFamily: T.mono,
  },
})
