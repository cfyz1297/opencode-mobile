import { memo, useCallback, useEffect, useState } from "react"
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"
import { useTranslation } from "react-i18next"
import { Markdown } from "../markdown"
import { ToolCallCard } from "./ToolCallCard"
import { ReasoningBlock } from "./ReasoningBlock"
import { CompactionCard } from "./CompactionCard"
import type { Message, Part } from "../../lib/sdk"
import { T } from "../../theme/tokens"

const SCREEN_WIDTH = Dimensions.get("window").width

function isImageMime(mime?: string): boolean {
  return !!mime && mime.startsWith("image/")
}

interface Props {
  message: Message
  parts: Part[]
  isDark: boolean
  // Only wired up for user messages — long-press opens the "Edit message" /
  // revert action sheet. Identified by messageID (not a closure over parts)
  // so it stays correct even if the memo below bails on a stale render.
  onLongPress?: (messageID: string) => void
  // Reverts the session to (just before) this message — desktop's
  // "reset to this point". Offered on user messages only.
  onRevert?: (messageID: string) => void
}

// TODO: Replace with streamdown-rn once React 19 types PR lands - it has
// built-in block-level memoization that eliminates re-renders for stable blocks
export const MessageBubble = memo(
  function MessageBubble({ message, parts, isDark, onLongPress, onRevert }: Props) {
    const isUser = message.role === "user"
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)

    const textParts = parts.filter((p) => p.type === "text")
    const reasoningParts = parts.filter((p) => p.type === "reasoning")
    const toolParts = parts.filter((p) => p.type === "tool")
    const fileParts = parts.filter((p) => p.type === "file" && isImageMime(p.mime))
    const text = textParts.map((p) => p.text).join("\n") || ""
    const reasoning = reasoningParts.map((p) => p.text).join("\n") || ""

    // Copy the message's plain text (same content markdown renders). A failed
    // copy stays silent — a per-message alert row would be noise.
    const handleCopy = useCallback(async () => {
      try {
        await Clipboard.setStringAsync(text)
        setCopied(true)
      } catch {
        // ignore — nothing sane to do inside a per-row button
      }
    }, [text])

    // Auto-clear the "Copied" flash; the timeout is a no-op after unmount.
    useEffect(() => {
      if (!copied) return
      const id = setTimeout(() => setCopied(false), 1500)
      return () => clearTimeout(id)
    }, [copied])

    // Compaction messages carry the stored summary instead of regular text
    // parts — render them as the TUI's separator + summary block.
    const compactionPart = parts.find((p) => p.type === "compaction")
    if (compactionPart) return <CompactionCard part={compactionPart} isDark={isDark} />

    return (
      <TouchableOpacity
        activeOpacity={isUser && onLongPress ? 0.7 : 1}
        onLongPress={isUser && onLongPress ? () => onLongPress(message.id) : undefined}
        disabled={!isUser || !onLongPress}
        style={[s.bubble, isUser ? s.user : s.assistant]}
        testID={`chat-bubble-${message.role}`}
      >

        {/* Image attachments */}
        {fileParts.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.imageRow}
            style={s.imageScroll}
          >
            {fileParts.map((fp) => (
              <View key={fp.id} style={s.imageWrap}>
                <Image source={{ uri: fp.url }} style={s.attachedImage} resizeMode="cover" />
                {fp.filename && (
                  <Text style={[s.imageLabel, isDark && s.imageLabelDark]} numberOfLines={1}>
                    {fp.filename}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Reasoning (collapsible) */}
        {reasoning.length > 0 && <ReasoningBlock text={reasoning} isDark={isDark} />}

        {/* Message text */}
        {text.length > 0 &&
          (isUser ? (
            <Text style={[s.messageText, isDark && s.textWhite]} selectable>
              {text}
            </Text>
          ) : (
            <View style={s.markdownWrap}>
              <Markdown>{text}</Markdown>
            </View>
          ))}

        {/* Tool calls */}
        {toolParts.map((tool) => (
          <ToolCallCard key={tool.id} tool={tool} isDark={isDark} />
        ))}

        {/* Per-message actions — desktop parity: copy + "reset to this point".
            Shown under the bubble content so both icons are separate buttons. */}
        {(text.length > 0 || (isUser && !!onRevert) || !isUser) && (
          <View style={s.actionRow}>
            {!isUser && (message.model?.modelID ?? message.modelID) && (
              <Text style={s.modelTag} numberOfLines={1}>{message.model?.modelID ?? message.modelID}</Text>
            )}
            {text.length > 0 && (
              <TouchableOpacity
                style={s.actionBtn}
                onPress={handleCopy}
                accessibilityRole="button"
                accessibilityLabel={t("chat.message.copy")}
                testID={`message-copy-${message.role}`}
              >
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={12}
                  color={T.muted}
                />
                <Text style={s.actionText}>{copied ? t("chat.message.copied") : t("chat.message.copy")}</Text>
              </TouchableOpacity>
            )}
            {isUser && !!onRevert && (
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => onRevert(message.id)}
                accessibilityRole="button"
                accessibilityLabel={t("chat.message.revertHere")}
                testID="message-revert"
              >
                <Ionicons name="arrow-undo-outline" size={12} color={T.muted} />
                <Text style={s.actionText}>{t("chat.message.revertHere")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tokens/cost for assistant messages */}
        {!isUser && message.tokens && (
          <Text style={[s.tokens, isDark && s.tokensDark]}>
            {message.tokens.input + message.tokens.output} {t("chat.message.tokens")}
            {message.cost ? ` · $${message.cost.toFixed(4)}` : ""}
          </Text>
        )}
      </TouchableOpacity>
    )
  },
  (prev, next) => {
    // Only re-render if message content actually changed
    // This prevents completed messages from re-rendering during streaming.
    // The store replaces changed parts/messages with NEW object references,
    // so a reference-equality sweep over every part catches every real change
    // (including tool parts, which have no `.text`) while still skipping
    // unchanged (completed) messages during other messages' streaming.
    if (prev.message !== next.message) return false
    if (prev.isDark !== next.isDark) return false
    if (prev.onLongPress !== next.onLongPress) return false
    if (prev.onRevert !== next.onRevert) return false
    if (prev.parts.length !== next.parts.length) return false
    for (let i = 0; i < prev.parts.length; i++) {
      if (prev.parts[i] !== next.parts[i]) return false
    }
    return true
  },
)

const s = StyleSheet.create({
  // What you said sits in a soft block on the right; the reply is just text.
  bubble: { marginBottom: 22 },
  user: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    backgroundColor: T.paper2,
    borderRadius: T.radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistant: { alignSelf: "stretch" },
  userDark: {},
  assistantDark: {},
  textWhite: { fontFamily: T.font, color: T.ink },
  modelTag: { fontFamily: T.font, fontSize: 11, color: T.muted },
  modelTagDark: { fontFamily: T.font, color: T.muted },

  messageText: { fontFamily: T.font, fontSize: 16, lineHeight: 23, color: T.ink },
  markdownWrap: { marginHorizontal: 0 },

  tokens: { fontFamily: T.font, fontSize: 11, color: T.muted, marginTop: 8 },
  tokensDark: { fontFamily: T.font, color: T.muted },

  // Per-message actions (copy / reset-to-this-point), desktop parity.
  actionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2 },
  actionText: { fontFamily: T.font, fontSize: 11, color: T.muted },
  actionTextDark: { fontFamily: T.font, color: T.muted },

  // Images
  imageScroll: { marginBottom: 8 },
  imageRow: { gap: 8 },
  imageWrap: { alignItems: "center" },
  attachedImage: {
    width: Math.min(200, SCREEN_WIDTH * 0.5),
    height: Math.min(200, SCREEN_WIDTH * 0.5),
    borderRadius: T.radius,
    backgroundColor: T.paper,
  },
  imageLabel: { fontFamily: T.font, fontSize: 10, color: T.muted, marginTop: 2, maxWidth: 200 },
  imageLabelDark: { fontFamily: T.font, color: T.muted },
})
