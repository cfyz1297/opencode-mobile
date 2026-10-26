import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList } from "@gorhom/bottom-sheet"
import { useTranslation } from "react-i18next"
import { T } from "../../theme/tokens"

interface VariantOption {
  id: string | null
  label: string
  description: string
}

interface Props {
  variants: Record<string, { reasoningEffort?: string }> | undefined
  selected: string | null
  isDark: boolean
  onSelect: (variant: string | null) => void
  sheetRef: React.RefObject<BottomSheet | null>
}

export function VariantPicker({ variants, selected, isDark, onSelect, sheetRef }: Props) {
  const { t } = useTranslation()

  const effortDescriptions: Record<string, string> = {
    low: t("chat.variantPicker.effort.low"),
    medium: t("chat.variantPicker.effort.medium"),
    high: t("chat.variantPicker.effort.high"),
  }
  const autoOption: VariantOption = {
    id: null,
    label: t("chat.variantPicker.autoLabel"),
    description: t("chat.variantPicker.autoDescription"),
  }

  const options: VariantOption[] = [
    autoOption,
    ...Object.keys(variants || {}).map((id) => ({
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      description: effortDescriptions[id] ?? id,
    })),
  ]

  const handleSelect = (id: string | null) => {
    onSelect(id)
    sheetRef.current?.close()
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["30%", "50%"]}
      // See DirectoryBrowserSheet.tsx for why this is required alongside
      // static snapPoints (issue #104): without it the sheet can never open.
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundStyle={s.sheet}
      handleIndicatorStyle={{ backgroundColor: T.rule2 }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      )}
    >
      <View style={s.header}>
        <Text style={[s.title, isDark && s.textWhite]}>{t("chat.variantPicker.title")}</Text>
      </View>
      <BottomSheetFlatList
        data={options}
        keyExtractor={(item: VariantOption) => item.id ?? "auto"}
        renderItem={({ item }: { item: VariantOption }) => {
          const active = item.id === selected
          return (
            <TouchableOpacity
              style={[s.row, isDark && s.rowDark, active && (isDark ? s.rowSelectedDark : s.rowSelected)]}
              onPress={() => handleSelect(item.id)}
              testID={`variant-option-${item.id ?? "auto"}`}
            >
              <View style={s.rowText}>
                <Text style={[s.rowName, isDark && s.textWhite]}>{item.label}</Text>
                <Text style={[s.rowDesc, isDark && s.metaDark]}>{item.description}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={20} color={T.accent} />}
            </TouchableOpacity>
          )
        }}
        contentContainerStyle={s.content}
      />
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  sheet: { backgroundColor: T.paper2, borderTopWidth: 1, borderTopColor: T.rule2 },
  sheetDark: { backgroundColor: T.paper2 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontFamily: T.mono, fontSize: 18, fontWeight: "700", color: T.ink },
  textWhite: { fontFamily: T.mono, color: T.ink },
  metaDark: { fontFamily: T.mono, color: T.muted },
  content: { paddingBottom: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
  },
  rowDark: { borderBottomColor: T.rule },
  rowSelected: { backgroundColor: T.accentWash },
  rowSelectedDark: { backgroundColor: T.accentWash },
  rowText: { flex: 1 },
  rowName: { fontFamily: T.mono, fontSize: 15, fontWeight: "600", color: T.ink },
  rowDesc: { fontFamily: T.mono, fontSize: 12, color: T.muted, marginTop: 2 },
})
