import { useCallback, useMemo, useState } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, TextInput } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { buildModelPickerSections } from "../../lib/model-picker-filter"

// A model chooser rendered as a plain RN Modal. The New Session modal on the
// sessions screen is itself a native RN Modal, and RN Modals layer above every
// bottom-sheet portal in the React root (see the DirectoryBrowserSheet comment
// in app/(tabs)/index.tsx) — so the sessions screen cannot open the chat
// screen's BottomSheet-based ModelPicker from inside it. This twin covers that
// case with the same search + grouping as the session picker.
interface Provider {
  id: string
  name: string
  models: Array<{ id: string; name: string; free?: boolean }>
}

interface Props {
  visible: boolean
  providers: Provider[]
  selected: { providerID: string; modelID: string } | null
  isDark: boolean
  onClose: () => void
  onSelect: (providerID: string, modelID: string) => void
  /** Selecting "server default" clears the explicit choice (model = null). */
  onClear: () => void
}

export function ModelPickerModal({ visible, providers, selected, isDark, onClose, onSelect, onClear }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")

  const sections = useMemo(
    () => buildModelPickerSections({ providers, query: search, selected }),
    [providers, search, selected],
  )

  const handleSelect = useCallback(
    (providerID: string, modelID: string) => {
      onSelect(providerID, modelID)
      setSearch("")
    },
    [onSelect],
  )

  const handleClose = useCallback(() => {
    setSearch("")
    onClose()
  }, [onClose])

  const hasSelection = !!(selected?.providerID && selected?.modelID)

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, isDark && styles.panelDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, isDark && styles.textWhite]}>{t("chat.modelPicker.title")}</Text>
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
              <TouchableOpacity style={[styles.row, isDark && styles.rowDark]} onPress={onClear}>
                <Ionicons name="refresh" size={16} color={isDark ? "#888888" : "#666666"} />
                <Text style={[styles.rowNameMuted, isDark && styles.textDim, { marginLeft: 10 }]} numberOfLines={1}>
                  {t("chat.modelPicker.serverDefault")}
                </Text>
              </TouchableOpacity>
            )}
            {sections.map((section) => (
              <View key={section.title}>
                <View style={[styles.sectionHeader, isDark && styles.sectionHeaderDark]}>
                  <Text style={[styles.sectionTitle, isDark && styles.metaDark]}>{section.title}</Text>
                </View>
                {section.data.map((model) => {
                  const active = selected?.providerID === model.providerID && selected?.modelID === model.modelID
                  return (
                    <TouchableOpacity
                      key={`${model.providerID}/${model.modelID}`}
                      style={[styles.row, isDark && styles.rowDark, active && (isDark ? styles.rowSelectedDark : styles.rowSelected)]}
                      onPress={() => handleSelect(model.providerID, model.modelID)}
                      testID={`model-option-${model.providerID}-${model.modelID}`}
                    >
                      <View style={styles.rowText}>
                        <View style={styles.nameRow}>
                          <Text style={[styles.rowName, isDark && styles.textWhite]} numberOfLines={1}>
                            {model.modelName}
                          </Text>
                          {model.free ? (
                            <View style={[styles.freeBadge, isDark && styles.freeBadgeDark]}>
                              <Text style={[styles.freeBadgeText, isDark && styles.freeBadgeTextDark]}>
                                {t("chat.modelPicker.freeBadge")}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.rowProvider, isDark && styles.metaDark]} numberOfLines={1}>
                          {model.providerName}
                        </Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
            {sections.length === 0 && (
              <Text style={[styles.empty, isDark && styles.metaDark]}>{t("chat.modelPicker.empty")}</Text>
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
  textWhite: { color: "#ffffff" },
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
  metaDark: { color: "#666666" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  rowDark: { borderBottomColor: "#2a2a2a" },
  rowSelected: { backgroundColor: "#f5f3ff" },
  rowSelectedDark: { backgroundColor: "#1f1a2e" },
  rowText: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { fontSize: 15, fontWeight: "500", color: "#0a0a0a", flexShrink: 1 },
  rowNameMuted: { fontSize: 15, fontWeight: "500", color: "#666666" },
  rowProvider: { fontSize: 12, color: "#999999", marginTop: 1 },
  freeBadge: {
    backgroundColor: "#e8e8e8",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  freeBadgeDark: { backgroundColor: "#2a2a2a" },
  freeBadgeText: { fontSize: 11, fontWeight: "600", color: "#555555" },
  freeBadgeTextDark: { color: "#bbbbbb" },
  empty: { padding: 24, textAlign: "center", fontSize: 14, color: "#999999" },
})
