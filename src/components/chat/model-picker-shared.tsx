// Shared state and row rendering for the two model pickers. The containers
// differ on purpose: the chat screen opens a BottomSheet, while the New
// Session modal lives inside a native RN Modal, which always layers above
// every bottom-sheet portal (see ModelPickerModal.tsx). Everything below the
// container — search, grouping, favorites, row markup — is shared here.
import { useMemo, useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { buildModelPickerSections, type ModelPickerItem } from "../../lib/model-picker-filter"
import { useHiddenModels } from "../../stores/model-visibility"
import { useFavoriteModels } from "../../stores/model-favorites"
import { modelKey } from "../../lib/model-visibility"

export interface ModelPickerProvider {
  id: string
  name: string
  models: Array<{ id: string; name: string; free?: boolean }>
}

export function useModelPickerData(providers: ModelPickerProvider[], selected: { providerID: string; modelID: string } | null) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const { hidden, loaded } = useHiddenModels()
  const { favorites, toggle } = useFavoriteModels()
  const sections = useMemo(
    () =>
      buildModelPickerSections({
        providers: loaded ? providers : [],
        query: search,
        selected,
        hidden,
        favorites,
        favoritesTitle: t("chat.modelPicker.favorites"),
      }),
    [providers, search, selected, hidden, loaded, favorites, t],
  )
  return { t, search, setSearch, sections, favorites, toggle }
}

interface RowProps {
  item: ModelPickerItem
  selected: { providerID: string; modelID: string } | null
  isDark: boolean
  favorites: string[]
  onSelect: (providerID: string, modelID: string) => void
  onToggle: (providerID: string, modelID: string) => void
  freeLabel: string
  favoriteToggleLabel: string
}

export function ModelPickerRow({ item, selected, isDark, favorites, onSelect, onToggle, freeLabel, favoriteToggleLabel }: RowProps) {
  const active = selected?.providerID === item.providerID && selected?.modelID === item.modelID
  const starred = favorites.includes(modelKey(item.providerID, item.modelID))
  return (
    <TouchableOpacity
      style={[s.row, isDark && s.rowDark, active && (isDark ? s.rowSelectedDark : s.rowSelected)]}
      onPress={() => onSelect(item.providerID, item.modelID)}
      testID={`model-option-${item.providerID}-${item.modelID}`}
    >
      <View style={s.rowText}>
        <View style={s.nameRow}>
          <Text style={[s.rowName, isDark && s.textWhite]} numberOfLines={1}>
            {item.modelName || item.modelID}
          </Text>
          {item.free ? (
            <View style={[s.freeBadge, isDark && s.freeBadgeDark]}>
              <Text style={[s.freeBadgeText, isDark && s.freeBadgeTextDark]}>{freeLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[s.rowProvider, isDark && s.metaDark]} numberOfLines={1}>
          {item.providerName || item.providerID}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onToggle(item.providerID, item.modelID)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        testID={`model-favorite-${item.providerID}-${item.modelID}`}
        accessibilityLabel={favoriteToggleLabel}
      >
        <Ionicons
          name={starred ? "star" : "star-outline"}
          size={17}
          color={starred ? "#f59e0b" : isDark ? "#555555" : "#c0c0c0"}
        />
      </TouchableOpacity>
      {active && <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />}
    </TouchableOpacity>
  )
}

export const pickerStyles = StyleSheet.create({
  textWhite: { color: "#ffffff" },
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
})

const s = pickerStyles
