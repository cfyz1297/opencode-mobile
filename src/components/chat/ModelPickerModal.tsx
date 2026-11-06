import { useCallback } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

// A model chooser rendered as a plain RN Modal. The New Session modal on the
// sessions screen is itself a native RN Modal, and RN Modals layer above every
// bottom-sheet portal in the React root (see the DirectoryBrowserSheet comment
// in app/(tabs)/index.tsx) — so the sessions screen cannot open the chat
// screen's BottomSheet-based ModelPicker from inside it. The list itself is
// shared with that picker (model-picker-shared.tsx).
import { ModelPickerRow, pickerStyles as p, useModelPickerData, type ModelPickerProvider } from "./model-picker-shared"

interface Props {
  visible: boolean
  providers: ModelPickerProvider[]
  selected: { providerID: string; modelID: string } | null
  isDark: boolean
  onClose: () => void
  onSelect: (providerID: string, modelID: string) => void
  /** Selecting "server default" clears the explicit choice (model = null). */
  onClear: () => void
}

export function ModelPickerModal({ visible, providers, selected, isDark, onClose, onSelect, onClear }: Props) {
  const { t } = useTranslation()
  const { search, setSearch, sections, favorites, toggle } = useModelPickerData(providers, selected)

  const handleSelect = useCallback(
    (providerID: string, modelID: string) => {
      onSelect(providerID, modelID)
      setSearch("")
    },
    [onSelect, setSearch],
  )

  const handleClose = useCallback(() => {
    setSearch("")
    onClose()
  }, [onClose, setSearch])

  const hasSelection = !!(selected?.providerID && selected?.modelID)

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, isDark && styles.panelDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, isDark && p.textWhite]}>{t("chat.modelPicker.title")}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={isDark ? "#ffffff" : "#0a0a0a"} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.search, isDark && styles.searchDark]}
            placeholder={t("chat.modelPicker.searchPlaceholder")}
            placeholderTextColor={isDark ? "#666666" : "#999999"}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            testID="model-picker-modal-search"
          />

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {hasSelection && (
              <TouchableOpacity style={[p.row, isDark && p.rowDark]} onPress={onClear}>
                <Ionicons name="refresh" size={16} color={isDark ? "#888888" : "#666666"} />
                <Text style={[styles.rowNameMuted, isDark && styles.textDim, { marginLeft: 10 }]} numberOfLines={1}>
                  {t("chat.modelPicker.serverDefault")}
                </Text>
              </TouchableOpacity>
            )}
            {sections.map((section) => (
              <View key={section.title}>
                <View style={[styles.sectionHeader, isDark && styles.sectionHeaderDark]}>
                  <Text style={[styles.sectionTitle, isDark && p.metaDark]}>{section.title}</Text>
                </View>
                {section.data.map((model) => (
                  <ModelPickerRow
                    key={`${model.providerID}/${model.modelID}`}
                    item={model}
                    selected={selected}
                    isDark={isDark}
                    favorites={favorites}
                    onSelect={handleSelect}
                    onToggle={toggle}
                    freeLabel={t("chat.modelPicker.freeBadge")}
                    favoriteToggleLabel={t("chat.modelPicker.favoriteToggle")}
                  />
                ))}
              </View>
            ))}
            {sections.length === 0 && (
              <Text style={[styles.empty, isDark && p.metaDark]}>{t("chat.modelPicker.empty")}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", paddingHorizontal: 24 },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    maxHeight: "75%",
    paddingTop: 14,
  },
  panelDark: { backgroundColor: "#1a1a1a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0a0a0a" },
  textDim: { color: "#888888" },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0a0a0a",
  },
  searchDark: { backgroundColor: "#2a2a2a", color: "#ffffff" },
  list: { paddingBottom: 8 },
  sectionHeader: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderDark: { backgroundColor: "#111111" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowNameMuted: { fontSize: 15, fontWeight: "500", color: "#666666" },
  empty: { padding: 24, textAlign: "center", fontSize: 14, color: "#999999" },
})
