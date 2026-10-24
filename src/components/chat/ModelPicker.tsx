import { useState, useCallback, useMemo } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import BottomSheet, { BottomSheetBackdrop, BottomSheetSectionList, BottomSheetTextInput } from "@gorhom/bottom-sheet"
import { useTranslation } from "react-i18next"
import { buildModelPickerSections, type ModelPickerItem } from "../../lib/model-picker-filter"

interface Provider {
  id: string
  name: string
  models: Array<{ id: string; name: string; free?: boolean }>
}

interface Props {
  providers: Provider[]
  selected: { providerID: string; modelID: string } | null
  isDark: boolean
  onSelect: (providerID: string, modelID: string) => void
  sheetRef: React.RefObject<BottomSheet | null>
  /** Opens Settings → Providers (desktop "Manage models"). */
  onManageModels?: () => void
}

export function ModelPicker({ providers, selected, isDark, onSelect, sheetRef, onManageModels }: Props) {
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
      sheetRef.current?.close()
    },
    [onSelect, sheetRef],
  )

  const handleManage = useCallback(() => {
    setSearch("")
    sheetRef.current?.close()
    onManageModels?.()
  }, [onManageModels, sheetRef])

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["50%", "80%"]}
      // See DirectoryBrowserSheet.tsx for why this is required alongside
      // static snapPoints (issue #104): without it the sheet can never open.
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={isDark ? s.sheetDark : s.sheet}
      handleIndicatorStyle={{ backgroundColor: isDark ? "#666666" : "#cccccc" }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      )}
      onChange={(idx) => {
        if (idx === -1) setSearch("")
      }}
    >
      <View style={s.header}>
        <Text style={[s.title, isDark && s.textWhite]}>{t("chat.modelPicker.title")}</Text>
        <BottomSheetTextInput
          style={[s.search, isDark && s.searchDark]}
          placeholder={t("chat.modelPicker.searchPlaceholder")}
          placeholderTextColor={isDark ? "#666666" : "#999999"}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          testID="model-picker-search"
        />
      </View>
      <BottomSheetSectionList
        sections={sections}
        keyExtractor={(item: ModelPickerItem) => `${item.providerID}/${item.modelID}`}
        renderSectionHeader={({ section }: { section: { title: string } }) => (
          <View style={[s.sectionHeader, isDark && s.sectionHeaderDark]}>
            <Text style={[s.sectionTitle, isDark && s.metaDark]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }: { item: ModelPickerItem }) => {
          const active = selected?.providerID === item.providerID && selected?.modelID === item.modelID
          return (
            <TouchableOpacity
              style={[s.row, isDark && s.rowDark, active && (isDark ? s.rowSelectedDark : s.rowSelected)]}
              onPress={() => handleSelect(item.providerID, item.modelID)}
              testID={`model-option-${item.providerID}-${item.modelID}`}
            >
              <View style={s.rowText}>
                <View style={s.nameRow}>
                  <Text style={[s.rowName, isDark && s.textWhite]} numberOfLines={1}>
                    {item.modelName || item.modelID}
                  </Text>
                  {item.free ? (
                    <View style={[s.freeBadge, isDark && s.freeBadgeDark]}>
                      <Text style={[s.freeBadgeText, isDark && s.freeBadgeTextDark]}>
                        {t("chat.modelPicker.freeBadge")}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[s.rowProvider, isDark && s.metaDark]}>{item.providerName || item.providerID}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />}
            </TouchableOpacity>
          )
        }}
        ListFooterComponent={
          onManageModels ? (
            <TouchableOpacity
              style={[s.manageRow, isDark && s.manageRowDark]}
              onPress={handleManage}
              testID="model-picker-manage"
            >
              <Ionicons name="options-outline" size={18} color={isDark ? "#cccccc" : "#444444"} />
              <Text style={[s.manageText, isDark && s.textWhite]}>{t("chat.modelPicker.manageModels")}</Text>
            </TouchableOpacity>
          ) : null
        }
        contentContainerStyle={s.content}
        stickySectionHeadersEnabled
      />
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  sheet: { backgroundColor: "#ffffff" },
  sheetDark: { backgroundColor: "#1a1a1a" },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  title: { fontSize: 18, fontWeight: "700", color: "#0a0a0a" },
  textWhite: { color: "#ffffff" },
  search: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0a0a0a",
  },
  searchDark: { backgroundColor: "#2a2a2a", color: "#ffffff" },
  content: { paddingBottom: 40 },
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
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    marginTop: 4,
  },
  manageRowDark: { borderTopColor: "#2a2a2a" },
  manageText: { fontSize: 15, fontWeight: "500", color: "#0a0a0a" },
})
