import { useState, useCallback, useMemo } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetTextInput } from "@gorhom/bottom-sheet"
import { useTranslation } from "react-i18next"
import { T } from "../../theme/tokens"

interface Props {
  sheetRef: React.RefObject<BottomSheet | null>
  current?: string
  recents: string[]
  serverHome: string | null
  isDark: boolean
  onSwitch: (directory?: string) => void
  // Opens a browsable folder picker rooted at the server's filesystem, as an
  // alternative to typing a path. Optional so existing callers keep working.
  onBrowse?: () => void
}

export function DirectorySwitcher({ sheetRef, current, recents, serverHome, isDark, onSwitch, onBrowse }: Props) {
  const { t } = useTranslation()
  const [custom, setCustom] = useState("")

  const handleSelect = useCallback(
    (dir?: string) => {
      onSwitch(dir)
      setCustom("")
      sheetRef.current?.close()
    },
    [onSwitch, sheetRef],
  )

  const handleCustomSubmit = useCallback(() => {
    const dir = custom.trim()
    if (!dir) return
    handleSelect(dir)
  }, [custom, handleSelect])

  // Build list: server default + recents (excluding current)
  const items = useMemo(() => {
    const list: Array<{ label: string; dir?: string; active: boolean }> = [
      { label: t("chat.directorySwitcher.serverDefaultLabel"), dir: undefined, active: !current },
    ]
    for (const dir of recents) {
      if (dir === current) continue
      const short = dir.split("/").filter(Boolean).pop() || dir
      list.push({ label: short, dir, active: false })
    }
    return list
  }, [recents, current, t])

  const shortCurrent = current ? current.split("/").filter(Boolean).pop() || current : null

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["45%", "70%"]}
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
        if (idx === -1) setCustom("")
      }}
    >
      <View style={s.header}>
        <Text style={[s.title, isDark && s.white]}>{t("chat.directorySwitcher.title")}</Text>
        {shortCurrent && (
          <View style={s.current}>
            <Ionicons name="folder" size={14} color={T.accent} />
            <Text style={s.currentText} numberOfLines={1}>
              {shortCurrent}
            </Text>
          </View>
        )}
      </View>

      {/* Custom directory input */}
      <View style={s.inputWrap}>
        <BottomSheetTextInput
          style={[s.input, isDark && s.inputDark]}
          placeholder={serverHome ? `${serverHome}/...` : "/path/to/project"}
          placeholderTextColor={T.muted}
          value={custom}
          onChangeText={(text) => {
            if (serverHome && text === "~") setCustom(serverHome)
            else if (serverHome && text.startsWith("~/")) setCustom(serverHome + text.slice(1))
            else setCustom(text)
          }}
          onSubmitEditing={handleCustomSubmit}
          returnKeyType="go"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {custom.trim() && (
          <TouchableOpacity style={[s.goBtn, isDark && s.goBtnDark]} onPress={handleCustomSubmit}>
            <Ionicons name="arrow-forward" size={18} color={T.accentInk} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick path chips */}
      {(serverHome || onBrowse) && (
        <View style={s.chips}>
          {serverHome && (
            <>
              <TouchableOpacity style={[s.chip, isDark && s.chipDark]} onPress={() => setCustom(serverHome)}>
                <Text style={[s.chipText, isDark && s.chipTextDark]}>~</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, isDark && s.chipDark]} onPress={() => setCustom(serverHome + "/")}>
                <Text style={[s.chipText, isDark && s.chipTextDark]}>~/</Text>
              </TouchableOpacity>
            </>
          )}
          {onBrowse && (
            <TouchableOpacity
              style={[s.chip, s.chipBrowse, isDark && s.chipDark]}
              onPress={() => {
                sheetRef.current?.close()
                onBrowse()
              }}
            >
              <Ionicons name="folder-open-outline" size={14} color={T.accent} />
              <Text style={[s.chipText, isDark && s.chipTextDark]}>{t("chat.directorySwitcher.browseLabel")}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Recent directories */}
      <BottomSheetFlatList
        data={items}
        keyExtractor={(item: (typeof items)[number], i: number) => item.dir || `default-${i}`}
        renderItem={({ item }: { item: (typeof items)[number] }) => (
          <TouchableOpacity
            style={[s.row, isDark && s.rowDark, item.active && s.rowActive]}
            onPress={() => handleSelect(item.dir)}
          >
            <View style={s.rowIcon}>
              <Ionicons
                name={item.dir ? "folder-outline" : "server-outline"}
                size={20}
                color={item.active ? T.accent : T.muted}
              />
            </View>
            <View style={s.rowContent}>
              <Text style={[s.rowLabel, isDark && s.white, item.active && s.rowLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
              {item.dir && (
                <Text style={[s.rowPath, isDark && s.dimDark]} numberOfLines={1}>
                  {item.dir}
                </Text>
              )}
              {!item.dir && (
                <Text style={[s.rowPath, isDark && s.dimDark]}>{t("chat.directorySwitcher.usesServerDir")}</Text>
              )}
            </View>
            {item.active && <Ionicons name="checkmark-circle" size={20} color={T.accent} />}
          </TouchableOpacity>
        )}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          items.length > 1 ? (
            <Text style={[s.section, isDark && s.dimDark]}>{t("chat.directorySwitcher.recentProjectsLabel")}</Text>
          ) : null
        }
      />
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  sheet: { backgroundColor: T.paper2, borderTopWidth: 1, borderTopColor: T.rule2 },
  sheetDark: { backgroundColor: T.paper2 },
  header: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  title: { fontFamily: T.mono, fontSize: 18, fontWeight: "700", color: T.ink },
  white: { fontFamily: T.mono, color: T.ink },
  current: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currentText: {
    fontSize: 13,
    color: T.accent,
    fontWeight: "500",
    fontFamily: T.mono,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: T.accentWash,
    borderRadius: 0,
  },
  chipDark: {
    backgroundColor: T.accentWash,
  },
  chipBrowse: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: T.accent,
    fontFamily: T.mono,
  },
  chipTextDark: {
    color: T.accent,
    fontFamily: T.mono,
  },
  input: {
    flex: 1,
    backgroundColor: T.paper2,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: T.ink,
    fontFamily: T.mono,
  },
  inputDark: { fontFamily: T.mono, backgroundColor: T.paper3, color: T.ink },
  goBtn: {
    width: 36,
    height: 36,
    borderRadius: 0,
    backgroundColor: T.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  goBtnDark: { backgroundColor: T.accent },
  list: { paddingBottom: 40 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    color: T.muted,


    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    fontFamily: T.mono,
  },
  dimDark: { fontFamily: T.mono, color: T.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.rule,
    gap: 12,
  },
  rowDark: { borderBottomColor: T.rule },
  rowActive: { backgroundColor: T.accentWash },
  rowIcon: { width: 28, alignItems: "center" },
  rowContent: { flex: 1 },
  rowLabel: { fontFamily: T.mono, fontSize: 15, fontWeight: "500", color: T.ink },
  rowLabelActive: { fontFamily: T.mono, color: T.accent },
  rowPath: { fontFamily: T.mono, fontSize: 12, color: T.muted, marginTop: 1 },
})
