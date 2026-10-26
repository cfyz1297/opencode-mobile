import { useCallback, useRef, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetTextInput } from "@gorhom/bottom-sheet"
import { useTranslation } from "react-i18next"
import type { Client, FileEntry } from "../../lib/sdk"
import { parentOf, nameOf } from "../../lib/path-utils"
import { normalizeRoots, type FileRoot } from "../../lib/file-roots"
import { T } from "../../theme/tokens"

interface Props {
  sheetRef: React.RefObject<BottomSheet | null>
  // Directory to start browsing from whenever the sheet opens (project root, server home, etc).
  startDirectory: string | null
  // Builds a client rooted at an arbitrary absolute directory (see connections store).
  clientForDirectory: (directory: string) => Client | null
  isDark: boolean
  // Called with the chosen absolute directory when the user taps "Use this folder".
  onSelect: (directory: string) => void
  // Called whenever the sheet fully closes (selection or cancel).
  onDismiss?: () => void
}

export function DirectoryBrowserSheet({
  sheetRef,
  startDirectory,
  clientForDirectory,
  isDark,
  onSelect,
  onDismiss,
}: Props) {
  const { t } = useTranslation()
  const [browseDir, setBrowseDir] = useState<string | null>(null)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jumpPath, setJumpPath] = useState("")
  // Pinned top-level entries (drives, home dir) fetched from GET /file/roots.
  // Stays empty on older servers that don't expose the endpoint, or while a
  // fetch is in flight — the manual "Jump to path" input keeps working
  // either way.
  const [roots, setRoots] = useState<FileRoot[]>([])
  const loadToken = useRef(0)

  const load = useCallback(
    (dir: string) => {
      const client = clientForDirectory(dir)
      const token = ++loadToken.current
      setLoading(true)
      setError(null)
      if (!client) {
        setEntries([])
        setLoading(false)
        setError(t("chat.directoryBrowserSheet.noActiveConnection"))
        return
      }
      client.file
        .list({ path: "." })
        .then((items) => {
          if (loadToken.current !== token) return
          setEntries(items.filter((item) => item.type === "directory"))
        })
        .catch((err) => {
          if (loadToken.current !== token) return
          setEntries([])
          setError(err instanceof Error ? err.message : t("chat.directoryBrowserSheet.listFailed"))
        })
        .finally(() => {
          if (loadToken.current === token) setLoading(false)
        })
    },
    [clientForDirectory, t],
  )

  const enter = useCallback(
    (dir: string) => {
      setBrowseDir(dir)
      load(dir)
    },
    [load],
  )

  // Fetch pinned filesystem roots for the current server. Silently falls
  // back to no pinned roots (manual path entry still works) on older
  // servers or any request failure.
  const loadRoots = useCallback(
    (dir: string) => {
      const client = clientForDirectory(dir)
      if (!client) {
        setRoots([])
        return
      }
      client.file
        .roots()
        .then((result) => setRoots(normalizeRoots(result)))
        .catch(() => setRoots([]))
    },
    [clientForDirectory],
  )

  // The caller (app/(tabs)/index.tsx openBrowser) sets the start directory
  // via setState and calls sheetRef.current?.expand() in the very same
  // synchronous handler. expand() kicks off a reanimated-driven animation
  // whose onChange callback can fire before React has committed the
  // re-render that would give this component the new `startDirectory` prop
  // (issue #104: this raced consistently, leaving the sheet permanently
  // showing "Enter a path above to start browsing" because the FIRST
  // onChange(index=0) captured `startDirectory=null` from the initial
  // mount's closure and set wasOpen=true, which then blocked every later
  // onChange from ever calling enter() again for that open). Mirror the
  // prop into a ref, updated inline on every render (synchronous, no extra
  // render cycle) so the onChange handler below always reads the latest
  // value regardless of which render's closure the native side invokes.
  const startDirectoryRef = useRef(startDirectory)
  startDirectoryRef.current = startDirectory

  // Reset to the starting directory when the sheet transitions from closed
  // to open (not on drags between snap points), and notify on full close.
  const wasOpen = useRef(false)
  const handleSheetChange = useCallback(
    (index: number) => {
      if (index < 0) {
        wasOpen.current = false
        onDismiss?.()
        return
      }
      if (wasOpen.current) return // snap-point change while already open
      wasOpen.current = true
      setJumpPath("")
      const dir = startDirectoryRef.current
      if (dir) {
        enter(dir)
        loadRoots(dir)
      } else {
        // No starting directory known (e.g. server home not loaded yet):
        // show an explicit empty state instead of a previous open's entries.
        loadToken.current++
        setBrowseDir(null)
        setEntries([])
        setError(null)
        setLoading(false)
        setRoots([])
      }
    },
    [enter, loadRoots, onDismiss],
  )

  const goUp = useCallback(() => {
    if (!browseDir) return
    const parent = parentOf(browseDir)
    if (!parent) return
    enter(parent)
  }, [browseDir, enter])

  const goJump = useCallback(() => {
    const dir = jumpPath.trim()
    if (!dir) return
    setJumpPath("")
    enter(dir)
  }, [jumpPath, enter])

  const handleUseFolder = useCallback(() => {
    if (!browseDir) return
    onSelect(browseDir)
    sheetRef.current?.close()
  }, [browseDir, onSelect, sheetRef])

  const canGoUp = !!browseDir && !!parentOf(browseDir)

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["65%", "92%"]}
      // Static percentage snapPoints are provided above, but @gorhom/bottom-sheet
      // v5 defaults enableDynamicSizing to true, which requires content wrapped
      // in a size-reporting component (BottomSheetView) to ever compute a valid
      // detent — this sheet's children are plain Views/BottomSheetFlatList, so
      // contentHeight never resolves and the sheet can never open (expand() has
      // no valid snap position to animate to). Disable dynamic sizing so the
      // explicit snapPoints above are used directly. See GitHub issue #104.
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
      onChange={handleSheetChange}
    >
      <View style={s.header}>
        <Text style={[s.title, isDark && s.white]}>{t("chat.directoryBrowserSheet.title")}</Text>
        <View style={s.pathRow}>
          <TouchableOpacity onPress={goUp} disabled={!canGoUp} hitSlop={8} testID="directory-up-button">
            <Ionicons
              name="arrow-up-circle-outline"
              size={22}
              color={canGoUp ? (T.accent) : T.paper2}
            />
          </TouchableOpacity>
          <Text style={[s.path, isDark && s.dimDark]} numberOfLines={1} ellipsizeMode="head">
            {browseDir || "…"}
          </Text>
        </View>
      </View>

      {roots.length > 0 && (
        <View style={s.rootsRow}>
          {roots.map((root) => (
            <TouchableOpacity
              key={root.path}
              style={[s.rootChip, isDark && s.rootChipDark, browseDir === root.path && s.rootChipActive]}
              onPress={() => enter(root.path)}
              testID={`directory-root-${root.label}`}
            >
              <Ionicons
                name={root.label === "Home" ? "home-outline" : "layers-outline"}
                size={14}
                color={browseDir === root.path ? T.ink : T.accent}
              />
              <Text
                style={[
                  s.rootChipText,
                  isDark && s.rootChipTextDark,
                  browseDir === root.path && s.rootChipTextActive,
                ]}
                numberOfLines={1}
              >
                {root.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.inputWrap}>
        <BottomSheetTextInput
          style={[s.input, isDark && s.inputDark]}
          placeholder={t("chat.directoryBrowserSheet.jumpPlaceholder")}
          placeholderTextColor={T.muted}
          value={jumpPath}
          onChangeText={setJumpPath}
          onSubmitEditing={goJump}
          returnKeyType="go"
          autoCapitalize="none"
          autoCorrect={false}
          testID="directory-jump-input"
        />
        {jumpPath.trim() && (
          <TouchableOpacity style={[s.goBtn, isDark && s.goBtnDark]} onPress={goJump}>
            <Ionicons name="arrow-forward" size={18} color={T.accentInk} />
          </TouchableOpacity>
        )}
      </View>

      <BottomSheetFlatList
        data={entries}
        keyExtractor={(item: FileEntry) => item.absolute}
        renderItem={({ item }: { item: FileEntry }) => (
          <TouchableOpacity
            style={[s.row, isDark && s.rowDark]}
            onPress={() => enter(item.absolute)}
            testID={`directory-row-${item.name}`}
          >
            <Ionicons
              name="folder-outline"
              size={20}
              color={item.ignored ? (T.muted) : T.muted}
            />
            <Text style={[s.rowLabel, isDark && s.white, item.ignored && s.rowLabelDim]} numberOfLines={1}>
              {item.name}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={T.muted} />
          </TouchableOpacity>
        )}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          loading ? (
            <View style={s.centerBox}>
              <ActivityIndicator color={T.ink} />
            </View>
          ) : error ? (
            <View style={s.centerBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={[s.emptyText, isDark && s.dimDark]}>
              {browseDir
                ? t("chat.directoryBrowserSheet.noSubfolders")
                : t("chat.directoryBrowserSheet.enterPathHint")}
            </Text>
          ) : null
        }
      />

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.selectBtn, isDark && s.selectBtnDark, !browseDir && s.selectBtnDisabled]}
          onPress={handleUseFolder}
          disabled={!browseDir}
          testID="directory-select-button"
        >
          <Ionicons name="checkmark-circle" size={18} color={T.ink} />
          <Text style={[s.selectBtnText, isDark && s.selectBtnTextDark]} numberOfLines={1}>
            {t("chat.directoryBrowserSheet.useFolderButton", {
              folder: browseDir ? nameOf(browseDir) : t("chat.directoryBrowserSheet.thisFolderFallback"),
            })}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  sheet: { backgroundColor: T.paper2, borderTopWidth: 1, borderTopColor: T.rule2 },
  sheetDark: { backgroundColor: T.paper2 },
  header: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  title: { fontFamily: T.mono, fontSize: 18, fontWeight: "700", color: T.ink },
  white: { fontFamily: T.mono, color: T.ink },
  pathRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  path: {
    flex: 1,
    fontSize: 12,
    color: T.muted,
    fontFamily: T.mono,
  },
  dimDark: { fontFamily: T.mono, color: T.muted },
  rootsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  rootChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 0,
    backgroundColor: T.accentWash,
  },
  rootChipDark: { backgroundColor: T.accentWash },
  rootChipActive: { backgroundColor: T.accentWash },
  rootChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: T.accent,
    fontFamily: T.mono,
  },
  rootChipTextDark: { fontFamily: T.mono, color: T.accent },
  rootChipTextActive: { fontFamily: T.mono, color: T.ink },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 0,
    paddingHorizontal: 12,
    backgroundColor: T.paper2,
    color: T.ink,
    fontSize: 14,
    fontFamily: T.mono,
  },
  inputDark: {
    backgroundColor: T.paper3,
    color: T.ink,
    fontFamily: T.mono,
  },
  goBtn: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  goBtnDark: { backgroundColor: T.accent },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 0,
    backgroundColor: T.paper2,
    marginBottom: 6,
  },
  rowDark: { backgroundColor: T.paper3 },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.mono,
  },
  rowLabelDim: { fontFamily: T.mono, color: T.muted },
  centerBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  errorText: {
    fontSize: 13,
    color: T.ink2,
    textAlign: "center",
    paddingHorizontal: 16,
    fontFamily: T.mono,
  },
  emptyText: {
    fontSize: 13,
    color: T.muted,
    textAlign: "center",
    paddingVertical: 24,
    fontFamily: T.mono,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.rule,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 0,
    backgroundColor: T.accent,
  },
  selectBtnDark: { backgroundColor: T.accent },
  selectBtnDisabled: { opacity: 0.5 },
  selectBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: T.accentInk,
    fontFamily: T.mono,
  },
  selectBtnTextDark: { fontFamily: T.mono, color: T.accentInk },
})
