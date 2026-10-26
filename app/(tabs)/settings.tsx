import { useCallback, useEffect, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  useColorScheme,
  Linking,
  Alert,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { PROVIDERS_ROUTE } from "../../src/lib/providers-ui"
import { useAuth } from "../../src/stores/auth"
import { useSettings } from "../../src/stores/settings"
import {
  categories,
  categoryMeta,
  setup as setupNotifications,
  granted as notificationsGranted,
} from "../../src/lib/notifications"
import type { Category } from "../../src/lib/notifications"
import { ORIGINAL_REPO_URL, PRIVACY_POLICY_URL, PROJECT_REPO_URL } from "../../src/lib/links"
import { CURRENT_VERSION, checkForUpdate, type AvailableUpdate } from "../../src/lib/update-check"
import type { LocalePreference } from "../../src/lib/i18n/locale-resolve"
import { T } from "../../src/theme/tokens"

function SettingRow({
  icon,
  label,
  description,
  isDark,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  description?: string
  isDark: boolean
  right?: React.ReactNode
  onPress?: () => void
}) {
  const content = (
    <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
      <View style={[styles.settingIcon, isDark && styles.settingIconDark]}>
        <Ionicons name={icon} size={22} color={T.ink} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, isDark && styles.textDark]}>{label}</Text>
        {description && <Text style={[styles.settingDescription, isDark && styles.metaDark]}>{description}</Text>}
      </View>
      {right}
    </View>
  )

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>
  }

  return content
}

function SettingSection({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>{title}</Text>
      <View style={[styles.sectionContent, isDark && styles.sectionContentDark]}>{children}</View>
    </View>
  )
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const { settings, hasBiometrics, updateSettings, lock } = useAuth()
  const { notifications, setNotification, locale, setLocale } = useSettings()
  const [osGranted, setOsGranted] = useState<boolean | null>(null)

  // Settings is where a user goes to ask "what am I running?". Answer it, and if
  // a newer build exists say so here too — the banner on the sessions list is
  // dismissible, this row is not (AGE-110). Uses the same 24h-throttled check,
  // so opening Settings repeatedly costs no extra requests.
  const [updateAvailable, setUpdateAvailable] = useState<AvailableUpdate | null>(null)
  useEffect(() => {
    let cancelled = false
    checkForUpdate({ ignoreDismissed: true })
      .then((result) => {
        if (!cancelled) setUpdateAvailable(result)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // Check OS permission state on first toggle attempt
  const handleToggle = useCallback(
    async (category: Category, enabled: boolean) => {
      if (enabled) {
        const ok = await setupNotifications()
        setOsGranted(ok)
        if (!ok) {
          Alert.alert(t("settings.alerts.notificationsDisabledTitle"), t("settings.alerts.notificationsDisabledMessage"))
          return
        }
      }
      setNotification(category, enabled)
    },
    [setNotification, t],
  )

  // Lazy-check OS permission for status display
  if (osGranted === null) {
    notificationsGranted()
      .then(setOsGranted)
      .catch(() => setOsGranted(false))
  }

  const localeLabels: Record<LocalePreference, string> = {
    system: t("settings.language.system"),
    en: t("settings.language.en"),
    ru: t("settings.language.ru"),
    "zh-Hans": t("settings.language.zhHans"),
  }

  const handleLanguagePress = useCallback(() => {
    Alert.alert(t("settings.language.title"), undefined, [
      { text: localeLabels.system, onPress: () => setLocale("system") },
      { text: localeLabels.en, onPress: () => setLocale("en") },
      { text: localeLabels.ru, onPress: () => setLocale("ru") },
      { text: localeLabels["zh-Hans"], onPress: () => setLocale("zh-Hans") },
      { text: t("common.cancel"), style: "cancel" },
    ])
  }, [t, setLocale, localeLabels])

  return (
    <ScrollView style={[styles.container, isDark && styles.containerDark]} contentContainerStyle={styles.content}>
      <SettingRow icon="archive-outline" label={t('history.title')} description={t('history.readOnly')} isDark={isDark} onPress={() => router.push('/history')} />
      <SettingSection title={t("settings.sections.security")} isDark={isDark}>
        <SettingRow
          icon="finger-print"
          label={t("settings.security.biometricOpen.label")}
          description={
            hasBiometrics
              ? t("settings.security.biometricOpen.descriptionEnabled")
              : t("settings.security.biometricOpen.descriptionUnavailable")
          }
          isDark={isDark}
          right={
            <Switch
              value={settings.requireBiometric}
              onValueChange={(value) => updateSettings({ requireBiometric: value })}
              disabled={!hasBiometrics}
              trackColor={{ false: T.paper3, true: T.accent }}
            />
          }
        />
        <SettingRow
          icon="lock-closed"
          label={t("settings.security.biometricSend.label")}
          description={t("settings.security.biometricSend.description")}
          isDark={isDark}
          right={
            <Switch
              value={settings.requireBiometricForMessages}
              onValueChange={(value) => updateSettings({ requireBiometricForMessages: value })}
              disabled={!hasBiometrics || !settings.requireBiometric}
              trackColor={{ false: T.paper3, true: T.accent }}
            />
          }
        />
        {settings.requireBiometric && (
          <SettingRow
            icon="exit"
            label={t("settings.security.lockNow.label")}
            description={t("settings.security.lockNow.description")}
            isDark={isDark}
            onPress={lock}
            right={<Ionicons name="chevron-forward" size={20} color={T.muted} />}
          />
        )}
      </SettingSection>

      <SettingSection title={t("settings.sections.notifications")} isDark={isDark}>
        {categories.map((category) => {
          const meta = categoryMeta[category]
          return (
            <SettingRow
              key={category}
              icon={meta.icon as keyof typeof Ionicons.glyphMap}
              label={t(meta.labelKey)}
              description={t(meta.descriptionKey)}
              isDark={isDark}
              right={
                <Switch
                  value={notifications[category]}
                  onValueChange={(value) => handleToggle(category, value)}
                  trackColor={{ false: T.paper3, true: T.accent }}
                />
              }
            />
          )
        })}
        {osGranted === false && (
          <View style={[styles.settingRow, isDark && styles.settingRowDark]}>
            <Text style={[styles.settingDescription, { color: T.ink2, paddingLeft: 48 }]}>
              {t("settings.notifications.disabledNotice")}
            </Text>
          </View>
        )}
      </SettingSection>

      <SettingSection title={t("settings.sections.privacy")} isDark={isDark}>
        <SettingRow
          icon="document-text"
          label={t("settings.privacy.privacyPolicy.label")}
          description={t("settings.privacy.privacyPolicy.description")}
          isDark={isDark}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          right={<Ionicons name="open-outline" size={20} color={T.muted} />}
        />
      </SettingSection>

      <SettingSection title={t("settings.sections.providers")} isDark={isDark}>
        <SettingRow
          icon="cloud-outline"
          label={t("settings.providers.row.label")}
          description={t("settings.providers.row.description")}
          isDark={isDark}
          onPress={() => router.push(PROVIDERS_ROUTE)}
          right={<Ionicons name="chevron-forward" size={20} color={T.muted} />}
        />
        <SettingRow
          icon="options-outline"
          label={t("models.title")}
          description={t("models.settingsDescription")}
          isDark={isDark}
          onPress={() => router.push("/models")}
          right={<Ionicons name="chevron-forward" size={20} color={T.muted} />}
        />
      </SettingSection>

      <SettingSection title={t("settings.sections.about")} isDark={isDark}>
        <SettingRow
          icon="language"
          label={t("settings.language.label")}
          description={localeLabels[locale]}
          isDark={isDark}
          onPress={handleLanguagePress}
          right={<Ionicons name="chevron-forward" size={20} color={T.muted} />}
        />
        <SettingRow
          icon="information-circle"
          label={t("settings.about.version")}
          // Was hard-coded "1.0.0" — wrong for every build ever shipped, and the
          // one place a user could have checked what they are running while 64%
          // of the base sat on a four-week-old build (AGE-110).
          description={
            updateAvailable
              ? `${CURRENT_VERSION} → ${updateAvailable.version}`
              : `${CURRENT_VERSION} · ${t("update.upToDate")}`
          }
          isDark={isDark}
          onPress={updateAvailable ? () => Linking.openURL(updateAvailable.url) : undefined}
          right={
            updateAvailable ? (
              <Ionicons name="arrow-up-circle" size={20} color={T.ink2} />
            ) : undefined
          }
        />
        <SettingRow
          icon="logo-github"
          label={t("settings.about.github.label")}
          description={t("settings.about.github.description")}
          isDark={isDark}
          onPress={() => Linking.openURL(PROJECT_REPO_URL)}
          right={<Ionicons name="open-outline" size={20} color={T.muted} />}
        />
        <SettingRow
          icon="git-branch-outline"
          label={t("settings.about.upstream.label")}
          description={t("settings.about.upstream.description")}
          isDark={isDark}
          onPress={() => Linking.openURL(ORIGINAL_REPO_URL)}
          right={<Ionicons name="open-outline" size={20} color={T.muted} />}
        />
        <SettingRow
          icon="document-text"
          label={t("settings.about.docs.label")}
          description={t("settings.about.docs.description")}
          isDark={isDark}
          onPress={() => Linking.openURL("https://opencode.ai/docs")}
          right={<Ionicons name="open-outline" size={20} color={T.muted} />}
        />
      </SettingSection>

      <View style={styles.footer}>
        <Text style={[styles.footerText, isDark && styles.metaDark]}>{t("settings.footer.appName")}</Text>
        <Text style={[styles.footerText, isDark && styles.metaDark]}>{t("settings.footer.tagline")}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.paper2,
  },
  containerDark: {
    backgroundColor: T.paper,
  },
  content: {
    paddingBottom: 32,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: T.muted,
    marginLeft: 16,
    marginBottom: 8,

    fontFamily: T.mono,
  },
  sectionTitleDark: {
    color: T.muted,
    fontFamily: T.mono,
  },
  sectionContent: {
    backgroundColor: T.paper,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: T.rule,
  },
  sectionContentDark: {
    backgroundColor: T.paper2,
    borderColor: T.rule,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  settingRowDark: {
    borderBottomColor: T.rule,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 0,
    backgroundColor: T.accentWash,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingIconDark: {
    backgroundColor: T.paper3,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: T.ink,
    fontFamily: T.mono,
  },
  textDark: {
    color: T.ink,
    fontFamily: T.mono,
  },
  settingDescription: {
    fontSize: 13,
    color: T.muted,
    marginTop: 2,
    fontFamily: T.mono,
  },
  metaDark: {
    color: T.muted,
    fontFamily: T.mono,
  },
  footer: {
    alignItems: "center",
    padding: 32,
  },
  footerText: {
    fontSize: 13,
    color: T.muted,
    textAlign: "center",
    fontFamily: T.mono,
  },
})
