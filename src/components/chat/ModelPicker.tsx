import { useState, useCallback, useMemo } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import BottomSheet, { BottomSheetBackdrop, BottomSheetSectionList, BottomSheetTextInput } from "@gorhom/bottom-sheet"
import { useTranslation } from "react-i18next"
import { buildModelPickerSections, type ModelPickerItem } from "../../lib/model-picker-filter"
import { T } from "../../theme/tokens"

import { useHiddenModels } from "../../stores/model-visibility"

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
  /** Opens Settings → Models. */
  onManageModels?: () => void
}

export function ModelPicker({ providers, selected, isDark, onSelect, sheetRef, onManageModels }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const { hidden, loaded } = useHiddenModels()

  const sections = useMemo(
    () => buildModelPickerSections({ providers: loaded ? providers : [], query: search, selected, hidden }),
    [providers, search, selected, hidden, loaded],
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
      backgroundStyle={s.sheet}
      handleIndicatorStyle={{ backgroundColor: T.rule2 }}
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
          placeholderTextColor={T.muted}
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
              {active && <Ionicons name="checkmark-circle" size={20} color={T.accent} />}
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
              <Ionicons name="options-outline" size={18} color={T.ink} />
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
  sheet: { backgroundColor: T.paper2, borderTopWidth: 1, borderTopColor: T.rule2 },
  sheetDark: { backgroundColor: T.paper2 },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  title: { fontFamily: T.font, fontSize: 18, fontWeight: "700", color: T.ink },
  textWhite: { fontFamily: T.font, color: T.ink },
  search: {
    backgroundColor: T.paper2,
    borderRadius: T.radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: T.ink,
  },
  searchDark: { fontFamily: T.font, backgroundColor: T.paper3, color: T.ink },
  content: { paddingBottom: 40 },
  sectionHeader: {
    backgroundColor: T.paper2,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderDark: { backgroundColor: T.paper },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: T.muted,


    fontFamily: T.font,
  },
  metaDark: { fontFamily: T.font, color: T.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
  },
  rowDark: { borderBottomColor: T.rule },
  rowSelected: { backgroundColor: T.accentWash },
  rowSelectedDark: { backgroundColor: T.accentWash },
  rowText: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { fontFamily: T.font, fontSize: 15, fontWeight: "500", color: T.ink, flexShrink: 1 },
  rowProvider: { fontFamily: T.font, fontSize: 12, color: T.muted, marginTop: 1 },
  freeBadge: {
    backgroundColor: T.paper2,
    borderRadius: T.radius,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  freeBadgeDark: { backgroundColor: T.paper3 },
  freeBadgeText: { fontFamily: T.font, fontSize: 11, fontWeight: "600", color: T.muted },
  freeBadgeTextDark: { fontFamily: T.font, color: T.muted },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.rule,
    marginTop: 4,
  },
  manageRowDark: { borderTopColor: T.rule },
  manageText: { fontFamily: T.font, fontSize: 15, fontWeight: "500", color: T.ink },
})
