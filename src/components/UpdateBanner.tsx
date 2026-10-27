/**
 * "A newer version exists" — the only way a sideloaded install ever learns that.
 *
 * Deliberately not a modal: a modal on launch is the fastest way to get an app
 * uninstalled, and this must be safe to ship to the whole install base. It is a
 * single dismissible strip above the session list, with a "Not now" that sticks
 * for that version (see update-check-policy.ts).
 *
 * Renders nothing at all when there is no update, when the check failed, on
 * iOS, or once dismissed — so the common case costs one hook and no pixels.
 */

import { useCallback, useEffect, useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { checkForUpdate, dismissUpdate, CURRENT_VERSION, type AvailableUpdate } from "../lib/update-check"
import { T } from "../theme/tokens"

export function UpdateBanner({ isDark }: { isDark: boolean }) {
  const { t } = useTranslation()
  const [update, setUpdate] = useState<AvailableUpdate | null>(null)

  useEffect(() => {
    let cancelled = false
    checkForUpdate()
      .then((result) => {
        if (!cancelled) setUpdate(result)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const onDismiss = useCallback(() => {
    if (update) void dismissUpdate(update.version)
    setUpdate(null)
  }, [update])

  const onOpen = useCallback(async () => {
    if (!update) return
    // Opening the release page is also an implicit "I've seen this version":
    // do not nag about it again either. But only dismiss after the URL opens —
    // if openURL fails (no browser), keep the banner visible (BUG-026).
    const opened = await Linking.openURL(update.url).catch(() => false)
    if (opened) void dismissUpdate(update.version)
  }, [update])

  if (!update) return null

  return (
    <View style={[styles.banner, isDark && styles.bannerDark]} testID="update-banner">
      <Ionicons name="arrow-up-circle" size={20} color={T.ink2} />
      <View style={styles.text}>
        <Text style={[styles.title, isDark && styles.titleDark]}>{t("update.available")}</Text>
        <Text style={[styles.body, isDark && styles.bodyDark]} numberOfLines={1}>
          {t("update.body", { version: update.version, current: CURRENT_VERSION })}
        </Text>
      </View>
      <TouchableOpacity onPress={onOpen} testID="update-banner-open" hitSlop={8}>
        <Text style={[styles.action, isDark && styles.actionDark]}>{t("update.action")}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} testID="update-banner-dismiss" hitSlop={8}>
        <Ionicons name="close" size={18} color={T.ink} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T.paper2,
  },
  bannerDark: {
    backgroundColor: T.paper2,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.font,
  },
  titleDark: {
    color: T.ink,
    fontFamily: T.font,
  },
  body: {
    fontSize: 12,
    color: T.ink2,
    fontFamily: T.font,
  },
  bodyDark: {
    color: T.ink,
    fontFamily: T.font,
  },
  action: {
    fontSize: 14,
    fontWeight: "600",
    color: T.ink2,
    fontFamily: T.font,
  },
  actionDark: {
    color: T.ink2,
    fontFamily: T.font,
  },
})
