import { useCallback, useMemo } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

// A model chooser rendered as a plain RN Modal. The New Session modal on the
// sessions screen is itself a native RN Modal, and RN Modals layer above every
// bottom-sheet portal in the React root (see the DirectoryBrowserSheet comment
// in app/(tabs)/index.tsx) — so the sessions screen cannot open the chat
// screen's BottomSheet-based ModelPicker from inside it. This twin covers that
// case: no search field (keeps the panel keyboard-free inside the nested
// modal), one checkmark row per model.
interface Provider {
  id: string
  name: string
  models: Array<{ id: string; name: string }>
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

  const groups = useMemo(() => {
    const list = Array.isArray(providers) ? providers : []
    return list
      .filter((p) => (p.models || []).length > 0)
      .map((p) => ({
        id: p.id,
        name: p.name || p.id,
        models: (p.models || []).map((m) => ({
          id: m.id,
          name: m.name || m.id,
        })),
      }))
  }, [providers])

  const handleSelect = useCallback(
    (providerID: string, modelID: string) => {
      onSelect(providerID, modelID)
    },
    [onSelect],
  )

  const hasSelection = !!(selected?.providerID && selected?.modelID)

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, isDark && styles.panelDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, isDark && styles.textWhite]}>{t("chat.modelPicker.title")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={isDark ? "#ffffff" : "#0a0a0a"} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {hasSelection && (
              <TouchableOpacity style={[styles.row, isDark && styles.rowDark]} onPress={onClear}>
                <Ionicons name="refresh" size={16} color={isDark ? "#888888" : "#666666"} />
                <Text style={[styles.rowNameMuted, isDark && styles.textDim, { marginLeft: 10 }]} numberOfLines={1}>
                  {t("chat.modelPicker.serverDefault")}
                </Text>
              </TouchableOpacity>
            )}
            {groups.map((group) => (
              <View key={group.id}>
                <View style={[styles.sectionHeader, isDark && styles.sectionHeaderDark]}>
                  <Text style={[styles.sectionTitle, isDark && styles.metaDark]}>{group.name}</Text>
                </View>
                {group.models.map((model) => {
                  const active = selected?.providerID === group.id && selected?.modelID === model.id
                  return (
                    <TouchableOpacity
                      key={model.id}
                      style={[styles.row, isDark && styles.rowDark, active && (isDark ? styles.rowSelectedDark : styles.rowSelected)]}
                      onPress={() => handleSelect(group.id, model.id)}
                      testID={`model-option-${group.id}-${model.id}`}
                    >
                      <View style={styles.rowText}>
                        <Text style={[styles.rowName, isDark && styles.textWhite]} numberOfLines={1}>
                          {model.name}
                        </Text>
                        <Text style={[styles.rowProvider, isDark && styles.metaDark]} numberOfLines={1}>
                          {group.name}
                        </Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
            {groups.length === 0 && (
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
    overflow: "hidden",
  },
  panelDark: { backgroundColor: "#171717" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },
  list: { flexGrow: 0 },
  sectionHeader: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionHeaderDark: { backgroundColor: "#0d0d0d" },
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
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  rowDark: { borderBottomColor: "#2a2a2a" },
  rowSelected: { backgroundColor: "#f5f3ff" },
  rowSelectedDark: { backgroundColor: "#1f1a2e" },
  rowText: { flex: 1, paddingRight: 8 },
  rowName: { fontSize: 15, fontWeight: "500", color: "#0a0a0a" },
  rowNameMuted: { fontSize: 15, color: "#444444", flex: 1 },
  textDim: { color: "#999999" },
  rowProvider: { fontSize: 12, color: "#999999", marginTop: 1 },
  empty: { padding: 24, textAlign: "center", fontSize: 14, color: "#999999" },
})
