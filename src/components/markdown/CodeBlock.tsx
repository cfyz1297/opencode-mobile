import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Platform, ScrollView } from "react-native"
import * as Clipboard from "expo-clipboard"
import { useTranslation } from "react-i18next"
import { WIDE_CONTENT_SCROLL_CONFIG } from "../../lib/scroll-config"
import { T } from "../../theme/tokens"

interface Props {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: Props) {
  const isDark = useColorScheme() === "dark"
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.language, isDark && styles.languageDark]}>{language || "code"}</Text>
        <TouchableOpacity onPress={copy} hitSlop={8}>
          <Text style={[styles.copyBtn, isDark && styles.copyBtnDark]}>
            {copied ? t("chat.message.copied") : t("chat.message.copy")}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView {...WIDE_CONTENT_SCROLL_CONFIG} testID="code-block-scroll" contentContainerStyle={styles.codeScroll}>
        <Text style={[styles.code, isDark && styles.codeDark]} selectable>
          {code}
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: T.paper2,
    borderRadius: 0,
    marginVertical: 8,
    overflow: "hidden",
  },
  containerDark: {
    backgroundColor: T.paper2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: T.paper2,
  },
  headerDark: {
    backgroundColor: T.paper3,
  },
  language: {
    fontSize: 11,
    fontWeight: "600",
    color: T.muted,

    fontFamily: T.mono,
  },
  languageDark: {
    color: T.muted,
    fontFamily: T.mono,
  },
  copyBtn: {
    fontSize: 11,
    color: T.accent,
    fontWeight: "600",
    fontFamily: T.mono,
  },
  copyBtnDark: {
    color: T.accent,
    fontFamily: T.mono,
  },
  codeScroll: {
    padding: 12,
  },
  code: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    lineHeight: 20,
    color: T.ink,
  },
  codeDark: {
    color: T.ink2,
    fontFamily: T.mono,
  },
})
