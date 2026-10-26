import { useEffect, type ReactNode } from "react"
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useAuth } from "../stores/auth"
import { T } from "../theme/tokens"

interface Props {
  children: ReactNode
}

export function AuthGate({ children }: Props) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const { isAuthenticated, settings, hasBiometrics, biometricType, authenticate, error } = useAuth()

  // Auto-prompt the OS biometric dialog when the lock screen appears — including
  // after re-lock from background (see _layout.tsx useEffect on "background").
  // BUG-020: previously only ran on mount ([] deps), so after re-lock the user
  // had to tap "Unlock" manually instead of being auto-prompted.
  useEffect(() => {
    if (settings.requireBiometric && hasBiometrics && !isAuthenticated) {
      authenticate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // If biometric not required, or no biometrics available, show children
  if (!settings.requireBiometric || !hasBiometrics) {
    return <>{children}</>
  }

  // If authenticated, show children
  if (isAuthenticated) {
    return <>{children}</>
  }

  // Show auth screen
  const iconName =
    biometricType === 1 // FINGERPRINT
      ? "finger-print"
      : biometricType === 2 // FACIAL_RECOGNITION
        ? "scan"
        : "lock-closed"

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.content}>
        <Ionicons name={iconName} size={64} color={T.ink} />
        <Text style={[styles.title, isDark && styles.textDark]}>{t("authGate.title")}</Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>{t("authGate.subtitle")}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.button, isDark && styles.buttonDark]} onPress={authenticate}>
          <Ionicons name={iconName} size={24} color={T.ink} />
          <Text style={[styles.buttonText, isDark && styles.buttonTextDark]}>{t("authGate.unlockButton")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.paper,
    justifyContent: "center",
    alignItems: "center",
  },
  containerDark: {
    backgroundColor: T.paper,
  },
  content: {
    alignItems: "center",
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginTop: 24,
    color: T.ink,
    fontFamily: T.mono,
  },
  textDark: {
    color: T.ink,
    fontFamily: T.mono,
  },
  subtitle: {
    fontSize: 16,
    color: T.muted,
    marginTop: 8,
    textAlign: "center",
    fontFamily: T.mono,
  },
  subtitleDark: {
    color: T.muted,
    fontFamily: T.mono,
  },
  error: {
    color: T.ink2,
    marginTop: 16,
    fontSize: 14,
    fontFamily: T.mono,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 0,
    marginTop: 32,
    gap: 12,
  },
  buttonDark: {
    backgroundColor: T.accent,
  },
  buttonText: {
    color: T.accentInk,
    fontSize: 18,
    fontWeight: "600",
    fontFamily: T.mono,
  },
  buttonTextDark: {
    color: T.accentInk,
    fontFamily: T.mono,
  },
})
