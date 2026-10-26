import { useCallback, useMemo, useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Linking,
} from "react-native"
import { router, useFocusEffect } from "expo-router"
import { useKeyboardHeight } from "../../src/lib/use-keyboard-height"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSessions } from "../../src/stores/sessions"
import { useConnections } from "../../src/stores/connections"
import { useEvents } from "../../src/stores/events"
import { useCatalog } from "../../src/stores/catalog"
import type BottomSheet from "@gorhom/bottom-sheet"
import type { Session, Project } from "../../src/lib/sdk"
import { DirectorySwitcher, DirectoryBrowserSheet, ModelPickerModal } from "../../src/components/chat"
import { groupByDirectory } from "../../src/lib/session-grouping"
import { UpdateBanner } from "../../src/components/UpdateBanner"
import { nameOf } from "../../src/lib/path-utils"
import { SETUP_GUIDE_URL } from "../../src/lib/links"
import { T } from "../../src/theme/tokens"

function formatTime(timestamp: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return t("sessionsList.time.justNow")
  if (diff < 3600000) return t("sessionsList.time.minutesAgo", { count: Math.floor(diff / 60000) })
  if (diff < 86400000) return t("sessionsList.time.hoursAgo", { count: Math.floor(diff / 3600000) })
  if (diff < 604800000) return t("sessionsList.time.daysAgo", { count: Math.floor(diff / 86400000) })

  return date.toLocaleDateString()
}

function SessionItem({
  session,
  isDark,
  onRename,
  onDelete,
}: {
  session: Session
  isDark: boolean
  onRename: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()

  const onPress = () => {
    router.push({
      pathname: `/session/[id]`,
      params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
    })
  }

  const onLongPress = () => {
    Alert.alert(session.title || t("sessionsList.untitledSession"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("sessionsList.actions.rename"), onPress: onRename },
      { text: t("common.delete"), style: "destructive", onPress: onDelete },
    ])
  }

  // Extract short directory name from session
  const shortDir = session.directory ? session.directory.split("/").filter(Boolean).pop() : null

  return (
    <TouchableOpacity
      style={[styles.sessionItem, isDark && styles.sessionItemDark]}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={`session-item-${session.id}`}
    >
      <View style={styles.sessionContent}>
        <View style={styles.sessionHeader}>
          <Text style={[styles.sessionTitle, isDark && styles.textDark]} numberOfLines={1}>
            {session.title || t("sessionsList.untitledSession")}
          </Text>
        </View>
        <View style={styles.sessionMetaRow}>
          <Text style={[styles.sessionMeta, isDark && styles.metaDark]}>
            {formatTime(session.time.updated, t)}
            {/* summary is always present but files defaults to 0 until the
                server populates it — only show the count when it's meaningful,
                matching the SessionInfo panel's `summary.files > 0` guard (#55) */}
            {session.summary && session.summary.files > 0 &&
              ` · ${t("sessionsList.filesCount", { count: session.summary.files })}`}
          </Text>
          {shortDir && (
            <View style={styles.sessionDirBadge}>
              <Ionicons name="folder-outline" size={12} color={T.muted} />
              <Text style={[styles.sessionDirText, isDark && styles.metaDark]}>{shortDir}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={T.muted} />
    </TouchableOpacity>
  )
}

// Flattened list row — either a collapsible group header or a session.
// A single flat array keeps FlatList's refresh/empty-state handling as-is
// instead of switching to SectionList.
type ListRow =
  | { type: "header"; directory: string; shortName: string; count: number; collapsed: boolean }
  | { type: "session"; session: Session }

function GroupHeader({
  row,
  isDark,
  onToggle,
}: {
  row: { directory: string; shortName: string; count: number; collapsed: boolean }
  isDark: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.groupHeader, isDark && styles.groupHeaderDark]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Ionicons name="folder-outline" size={16} color={T.accent} />
      <Text style={[styles.groupHeaderText, isDark && styles.textDark]} numberOfLines={1}>
        {row.shortName}
      </Text>
      <Text style={[styles.groupHeaderCount, isDark && styles.metaDark]}>{row.count}</Text>
      <Ionicons
        name={row.collapsed ? "chevron-forward" : "chevron-down"}
        size={16}
        color={T.muted}
      />
    </TouchableOpacity>
  )
}

// Get short directory name (last folder or project name)
function getShortPath(
  project: { path?: { cwd?: string; root?: string; absolute?: string }; name?: string } | null | undefined,
): string {
  if (!project) return ""
  if (project.name) return project.name
  if (!project.path?.absolute) return ""
  const parts = project.path.absolute.split("/").filter(Boolean)
  return parts[parts.length - 1] || project.path.absolute
}

export default function SessionsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()
  // Exact avoidance inside the modals (see use-keyboard-height): RN core's
  // KeyboardAvoidingView "height" behavior mis-sizes under edge-to-edge.
  const kbHeight = useKeyboardHeight()
  const [showNewSession, setShowNewSession] = useState(false)
  // Model chooser for the New Session modal. Catalog selections and providers
  // are global (useCatalog) — picking a model here applies to the session
  // created next, and the chat screen keeps offering it afterwards.
  const [showModelPicker, setShowModelPicker] = useState(false)
  const catalogModel = useCatalog((s) => s.model)
  const catalogProviders = useCatalog((s) => s.providers)
  const setCatalogModel = useCatalog((s) => s.setModel)
  const [customDir, setCustomDir] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [renaming, setRenaming] = useState<Session | null>(null)
  const [renameText, setRenameText] = useState("")
  const renamingInFlight = useRef(false)
  // Synchronous re-entrancy guard: `isCreating` state lags by a render, so a
  // fast double-tap on the FAB / "Use this folder" would fire two session
  // creates before the disabled state lands. This blocks the second call.
  const creatingInFlight = useRef(false)
  const [serverProjects, setServerProjects] = useState<Project[]>([])

  const { sessions, isLoading, error, loadSessions, createSession, deleteSession } = useSessions()
  const {
    activeConnection,
    client,
    currentProject,
    serverHome,
    refreshProject,
    clientForDirectory,
    switchDirectory,
    addRecentDirectory,
    recentDirectories,
  } = useConnections()
  const authError = useEvents((s) => s.authError)
  const reconnect = useEvents((s) => s.connect)
  const loadCatalog = useCatalog((s) => s.load)
  const dirSheetRef = useRef<BottomSheet>(null)
  const browserSheetRef = useRef<BottomSheet>(null)
  const [browseStartDir, setBrowseStartDir] = useState<string | null>(null)
  // Shared folder browser is opened either to pick a directory for a new
  // session, or to switch the active connection's directory.
  const [browseMode, setBrowseMode] = useState<"create" | "switch">("create")
  const [refreshing, setRefreshing] = useState(false)
  // Directories collapsed in the grouped session list. Empty by default —
  // all groups start expanded (#67).
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())

  const toggleGroup = useCallback((directory: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(directory)) next.delete(directory)
      else next.add(directory)
      return next
    })
  }, [])

  // Flatten sessions into header+item rows. Skip headers entirely when
  // everything lives in one directory — a lone header adds noise, not clarity.
  const rows = useMemo<ListRow[]>(() => {
    const groups = groupByDirectory(sessions)
    if (groups.length <= 1) {
      return sessions.map((session) => ({ type: "session", session }))
    }
    const out: ListRow[] = []
    for (const group of groups) {
      const collapsed = collapsedDirs.has(group.directory)
      out.push({
        type: "header",
        directory: group.directory,
        shortName: nameOf(group.directory) || group.directory,
        count: group.items.length,
        collapsed,
      })
      if (!collapsed) {
        for (const session of group.items) out.push({ type: "session", session })
      }
    }
    return out
  }, [sessions, collapsedDirs])

  // Fetch server-known projects when the new session modal opens
  useEffect(() => {
    if (!showNewSession || !client) return
    client.project
      .list()
      .then(setServerProjects)
      .catch(() => setServerProjects([]))
    // Keep the model catalog fresh for the New Session picker (no-op when
    // already loaded — the same load() runs on connection in _layout).
    void loadCatalog()
  }, [showNewSession, client, loadCatalog])

  const handleSwitchDirectory = useCallback(
    async (dir?: string) => {
      await switchDirectory(dir)
      loadSessions()
      refreshProject()
      loadCatalog()
    },
    [switchDirectory, loadSessions, refreshProject, loadCatalog],
  )

  useFocusEffect(
    useCallback(() => {
      if (client) {
        loadSessions()
        refreshProject()
      }
    }, [client, loadSessions, refreshProject]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadSessions(), refreshProject()])
    } catch (err) {
      console.error("Refresh failed:", err)
    } finally {
      setRefreshing(false)
    }
  }, [loadSessions, refreshProject])

  const handleRename = useCallback((session: Session) => {
    setRenameText(session.title || "")
    setRenaming(session)
  }, [])

  const submitRename = useCallback(async () => {
    const title = renameText.trim()
    if (!title || !renaming || renamingInFlight.current) return
    const renameClient = renaming.directory ? (clientForDirectory(renaming.directory) ?? client) : client
    if (!renameClient) return
    renamingInFlight.current = true
    try {
      await renameClient.session.update(renaming.id, { title })
      setRenaming(null)
      setRenameText("")
      loadSessions()
    } catch (err) {
      console.error("Rename failed:", err)
      Alert.alert(t("sessionsList.alerts.renameFailedTitle"), t("sessionsList.alerts.renameFailedMessage"))
    } finally {
      renamingInFlight.current = false
    }
  }, [renaming, renameText, client, clientForDirectory, loadSessions, t])

  const handleDelete = useCallback(
    (session: Session) => {
      Alert.alert(
        t("sessionsList.alerts.deleteTitle"),
        t("sessionsList.alerts.deleteMessage", { title: session.title || t("sessionsList.untitledSession") }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                await deleteSession(session.id)
              } catch (err) {
                console.error("Delete failed:", err)
                Alert.alert(t("sessionsList.alerts.deleteFailedTitle"), t("sessionsList.alerts.deleteFailedMessage"))
              }
            },
          },
        ],
      )
    },
    [deleteSession, t],
  )

  const onCreateSession = async () => {
    if (creatingInFlight.current) return
    creatingInFlight.current = true
    try {
      const session = await createSession()
      if (session) {
        router.push({
          pathname: `/session/[id]`,
          params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
        })
      } else {
        Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
      }
    } finally {
      creatingInFlight.current = false
    }
  }

  const onCreateInDirectory = async (dir?: string) => {
    if (!activeConnection) return
    if (creatingInFlight.current) return
    creatingInFlight.current = true
    setIsCreating(true)

    try {
      // If a custom directory is specified, use a one-off client for that directory
      // so we don't mutate the connection's default project
      if (dir && dir.trim()) {
        const dirClient = clientForDirectory(dir.trim())
        if (!dirClient) return
        try {
          const session = await dirClient.session.create({})
          addRecentDirectory(dir.trim())
          setShowNewSession(false)
          setCustomDir("")
          if (session) {
            router.push({
              pathname: `/session/[id]`,
              params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
            })
          }
        } catch (error) {
          console.error("Failed to create session in directory:", error)
          Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
        }
        return
      }

      const session = await createSession()
      setShowNewSession(false)
      setCustomDir("")
      if (session) {
        router.push({
          pathname: `/session/[id]`,
          params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) },
        })
      } else {
        Alert.alert(t("common.error"), t("sessionsList.alerts.createFailedMessage"))
      }
    } finally {
      creatingInFlight.current = false
      setIsCreating(false)
    }
  }

  // The browser sheet is a sibling of the New Session <Modal>. A native RN
  // Modal layers above everything in the React root (including bottom-sheet
  // portals), so the modal must be closed before the sheet is shown; this ref
  // remembers to bring it back if the user cancels without picking a folder.
  const restoreNewSessionOnDismiss = useRef(false)

  const openBrowser = useCallback(
    (startDir: string | null, mode: "create" | "switch") => {
      setBrowseStartDir(startDir || serverHome || null)
      setBrowseMode(mode)
      if (mode === "create" && showNewSession) {
        restoreNewSessionOnDismiss.current = true
        setShowNewSession(false)
      }
      browserSheetRef.current?.expand()
    },
    [serverHome, showNewSession],
  )

  const onBrowserSelect = useCallback(
    (directory: string) => {
      restoreNewSessionOnDismiss.current = false
      if (browseMode === "switch") {
        handleSwitchDirectory(directory)
        dirSheetRef.current?.close()
      } else {
        onCreateInDirectory(directory)
      }
    },
    [browseMode, handleSwitchDirectory, onCreateInDirectory],
  )

  const onBrowserDismiss = useCallback(() => {
    if (restoreNewSessionOnDismiss.current) {
      restoreNewSessionOnDismiss.current = false
      setShowNewSession(true)
    }
  }, [])

  const onFabPress = () => {
    // Quick create in current project
    onCreateSession()
  }

  const onFabLongPress = () => {
    // Show modal with more options
    setCustomDir("")
    setShowNewSession(true)
  }

  if (!activeConnection) {
    return (
      <View style={[styles.emptyContainer, isDark && styles.containerDark]}>
        <Ionicons name="server-outline" size={64} color={T.ink} />
        <Text style={[styles.emptyTitle, isDark && styles.textDark]}>{t("sessionsList.empty.noConnectionTitle")}</Text>
        <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>
          {t("sessionsList.empty.noConnectionSubtitle")}
        </Text>
        <TouchableOpacity
          style={[styles.addButton, isDark && styles.addButtonDark]}
          onPress={() => router.push("/connection/add")}
          testID="add-connection-button"
        >
          <Text style={[styles.addButtonText, isDark && styles.addButtonTextDark]}>
            {t("sessionsList.empty.addConnectionButton")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.setupGuideLink}
          onPress={() => Linking.openURL(SETUP_GUIDE_URL)}
          testID="setup-guide-link"
        >
          <Text style={styles.setupGuideLinkText}>{t("sessionsList.empty.setupGuideLink")}</Text>
        </TouchableOpacity>
        {/* No-server activation path (retention): a fully offline scripted
            demo, isolated from real connect/session state — see app/demo.tsx. */}
        <TouchableOpacity
          style={[styles.tryDemoButton, isDark && styles.tryDemoButtonDark]}
          onPress={() => router.push("/demo")}
          testID="try-demo-button"
        >
          <Ionicons name="play-circle-outline" size={16} color={T.accent} />
          <Text style={[styles.tryDemoButtonText, isDark && styles.tryDemoButtonTextDark]}>
            {t("sessionsList.empty.tryDemoButton")}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  // The SSE loop stopped retrying because the server rejected our
  // credentials (401/403) — no amount of pull-to-refresh fixes that, so
  // point the user straight at the fix instead of a spinner that never
  // resolves (issue #76).
  if (authError) {
    return (
      <View style={[styles.emptyContainer, isDark && styles.containerDark]}>
        <Ionicons name="lock-closed-outline" size={64} color={T.ink} />
        <Text style={[styles.emptyTitle, isDark && styles.textDark]}>{t("sessionsList.empty.authFailedTitle")}</Text>
        <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>
          {t("sessionsList.empty.authFailedSubtitle", { name: activeConnection.name })}
        </Text>
        <View style={styles.authErrorButtonRow}>
          <TouchableOpacity
            style={[styles.addButton, isDark && styles.addButtonDark]}
            onPress={() => router.push(`/connection/${activeConnection.id}`)}
            testID="fix-connection-button"
          >
            <Text style={[styles.addButtonText, isDark && styles.addButtonTextDark]}>
              {t("sessionsList.empty.checkCredentialsButton")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, isDark && styles.addButtonDark]}
            onPress={() => {
              // authError is cleared inside connect() itself once the retry
              // attempt starts (see src/stores/events.ts), so a manual
              // set() here isn't needed — just kick the SSE state machine.
              reconnect()
            }}
            testID="retry-connection-button"
          >
            <Text style={[styles.addButtonText, isDark && styles.addButtonTextDark]}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const shortPath = getShortPath(currentProject)

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Connection indicator — tap to switch project */}
      <TouchableOpacity
        style={[styles.connectionBar, isDark && styles.connectionBarDark]}
        onPress={() => dirSheetRef.current?.expand()}
        onLongPress={() => router.push("/(tabs)/connections")}
        activeOpacity={0.7}
        testID="connection-status-bar"
      >
        <View style={styles.connectionInfo}>
          <View style={[styles.connectionDot, { backgroundColor: T.accent }]} testID="connection-status-dot" />
          <Text style={[styles.connectionName, isDark && styles.textDark]} numberOfLines={1}>
            {activeConnection.name}
          </Text>
          {shortPath && (
            <>
              <Ionicons name="folder" size={14} color={T.muted} />
              <Text style={[styles.projectPath, isDark && styles.metaDark]} numberOfLines={1}>
                {shortPath}
              </Text>
            </>
          )}
        </View>
        <Ionicons name="swap-horizontal-outline" size={16} color={T.muted} />
      </TouchableOpacity>

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <UpdateBanner isDark={isDark} />

      {/* Figures the list already holds, printed as a tool would print them */}
      {sessions.length > 0 && (
        <View style={styles.statRow} testID="sessions-stat-row">
          <Text style={styles.statFigure}>{sessions.length}</Text>
          <Text style={styles.statLabel}>{t("sessionsList.statSessions")}</Text>
          <View style={styles.statRule} />
          <Text style={styles.statFigure}>{new Set(sessions.map((s) => s.directory ?? "")).size}</Text>
          <Text style={styles.statLabel}>{t("sessionsList.statProjects")}</Text>
        </View>
      )}

      <TouchableOpacity accessibilityRole="button" testID="open-offline-history" onPress={() => router.push('/history')} style={styles.historyRow}>
        <Ionicons name="time-outline" size={16} color={T.muted} />
        <Text style={styles.historyRowText}>{t('history.title')}</Text>
      </TouchableOpacity>

      <FlatList
        data={rows}
        keyExtractor={(row) => (row.type === "header" ? `dir:${row.directory}` : row.session.id)}
        renderItem={({ item: row }) =>
          row.type === "header" ? (
            <GroupHeader row={row} isDark={isDark} onToggle={() => toggleGroup(row.directory)} />
          ) : (
            <SessionItem
              session={row.session}
              isDark={isDark}
              onRename={() => handleRename(row.session)}
              onDelete={() => handleDelete(row.session)}
            />
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.ink} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={T.ink} />
            </View>
          ) : (
            <View style={styles.emptyList}>
              <Text style={[styles.emptyListText, isDark && styles.metaDark]}>{t("sessionsList.empty.noSessions")}</Text>
            </View>
          )
        }
        contentContainerStyle={sessions.length === 0 ? styles.emptyContent : undefined}
      />

      {/* FAB to create new session */}
      <TouchableOpacity
        style={[styles.fab, isDark && styles.fabDark]}
        onPress={onFabPress}
        onLongPress={onFabLongPress}
        delayLongPress={500}
        testID="new-session-fab"
      >
        <Ionicons name="add" size={28} color={T.accentInk} />
      </TouchableOpacity>

      {/* New Session Info Modal */}
      <Modal visible={showNewSession} animationType="slide" transparent onRequestClose={() => setShowNewSession(false)}>
        <View style={[styles.modalOverlay, { paddingBottom: kbHeight }]}>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setShowNewSession(false)} />
          <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDark && styles.textDark]}>{t("sessionsList.newSessionModal.title")}</Text>
              <TouchableOpacity onPress={() => setShowNewSession(false)}>
                <Ionicons name="close" size={24} color={T.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollBody} keyboardShouldPersistTaps="handled">
              {/* Current directory — tapping creates session immediately */}
              <Text style={[styles.modalLabel, isDark && styles.metaDark]}>
                {t("sessionsList.newSessionModal.currentProjectLabel")}
              </Text>
              <TouchableOpacity
                style={[styles.modalDirBox, isDark && styles.modalDirBoxDark]}
                onPress={() => onCreateInDirectory()}
                disabled={isCreating}
              >
                <Ionicons name="folder" size={20} color={T.accent} />
                <Text style={[styles.modalDirText, isDark && styles.textDark]} numberOfLines={2}>
                  {currentProject?.path?.absolute || activeConnection?.directory || t("sessionsList.newSessionModal.serverDefault")}
                </Text>
                <Ionicons name="arrow-forward-circle" size={20} color={T.accent} />
              </TouchableOpacity>

              {/* Model for the session created next */}
              <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                {t("sessionsList.newSessionModal.modelLabel")}
              </Text>
              <TouchableOpacity
                style={[styles.modalDirBox, isDark && styles.modalDirBoxDark]}
                onPress={() => setShowModelPicker(true)}
              >
                <Ionicons name="hardware-chip-outline" size={20} color={T.accent} />
                <Text style={[styles.modalDirText, isDark && styles.textDark]} numberOfLines={2}>
                  {catalogModel?.modelID || t("chat.modelPicker.serverDefault")}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={T.accent} />
              </TouchableOpacity>

              {/* Recent projects */}
              {recentDirectories.length > 0 && (
                <>
                  <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                    {t("sessionsList.newSessionModal.recentProjectsLabel")}
                  </Text>
                  {recentDirectories.map((dir) => {
                    const short = dir.split("/").filter(Boolean).pop() || dir
                    const isCurrent =
                      dir === (currentProject?.path?.absolute || activeConnection?.directory)
                    return (
                      <TouchableOpacity
                        key={dir}
                        style={[
                          styles.projectRow,
                          isDark && styles.projectRowDark,
                          isCurrent && styles.projectRowActive,
                        ]}
                        onPress={() => onCreateInDirectory(dir)}
                        disabled={isCreating}
                      >
                        <Ionicons
                          name="folder-outline"
                          size={18}
                          color={isCurrent ? T.accent : T.muted}
                        />
                        <View style={styles.projectRowContent}>
                          <Text
                            style={[
                              styles.projectRowName,
                              isDark && styles.textDark,
                              isCurrent && styles.projectRowNameActive,
                            ]}
                            numberOfLines={1}
                          >
                            {short}
                          </Text>
                          <Text style={[styles.projectRowPath, isDark && styles.metaDark]} numberOfLines={1}>
                            {dir}
                          </Text>
                        </View>
                        {isCurrent && <Ionicons name="checkmark-circle" size={18} color={T.accent} />}
                      </TouchableOpacity>
                    )
                  })}
                </>
              )}

              {/* Server-known projects (excluding current) */}
              {serverProjects.filter((p) => p.path?.absolute !== currentProject?.path?.absolute).length > 0 && (
                <>
                  <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                    {t("sessionsList.newSessionModal.serverProjectsLabel")}
                  </Text>
                  {serverProjects
                    .filter((p) => p.path?.absolute !== currentProject?.path?.absolute)
                    .map((p) => {
                      const short = p.name || p.path?.absolute?.split("/").filter(Boolean).pop() || p.id
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.projectRow, isDark && styles.projectRowDark]}
                          onPress={() => onCreateInDirectory(p.path?.absolute)}
                          disabled={isCreating}
                        >
                          <Ionicons name="code-slash-outline" size={18} color={T.muted} />
                          <View style={styles.projectRowContent}>
                            <Text style={[styles.projectRowName, isDark && styles.textDark]} numberOfLines={1}>
                              {short}
                            </Text>
                            {p.path?.absolute && (
                              <Text style={[styles.projectRowPath, isDark && styles.metaDark]} numberOfLines={1}>
                                {p.path.absolute}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                </>
              )}

              {/* Browse the server's filesystem instead of typing a path */}
              <TouchableOpacity
                style={[styles.projectRow, isDark && styles.projectRowDark, { marginTop: 16 }]}
                onPress={() =>
                  openBrowser(currentProject?.path?.absolute || activeConnection?.directory || null, "create")
                }
                disabled={isCreating}
                testID="browse-folders-button"
              >
                <Ionicons name="folder-open-outline" size={18} color={T.accent} />
                <View style={styles.projectRowContent}>
                  <Text style={[styles.projectRowName, isDark && styles.textDark]}>
                    {t("sessionsList.newSessionModal.browseFoldersLabel")}
                  </Text>
                  <Text style={[styles.projectRowPath, isDark && styles.metaDark]}>
                    {t("sessionsList.newSessionModal.browseFoldersHint")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={T.muted} />
              </TouchableOpacity>

              {/* Manual path input fallback */}
              <Text style={[styles.modalLabel, isDark && styles.metaDark, { marginTop: 16 }]}>
                {t("sessionsList.newSessionModal.enterPathLabel")}
              </Text>
              <TextInput
                style={[styles.modalInput, isDark && styles.modalInputDark]}
                placeholder={serverHome ? `${serverHome}/...` : "/path/to/project"}
                placeholderTextColor={T.muted}
                value={customDir}
                onChangeText={(text) => {
                  // Expand ~ to server home directory
                  if (serverHome && text.startsWith("~/")) {
                    setCustomDir(serverHome + text.slice(1))
                  } else if (serverHome && text === "~") {
                    setCustomDir(serverHome)
                  } else {
                    setCustomDir(text)
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {/* Quick path shortcuts */}
              {serverHome && (
                <View style={styles.pathChips}>
                  <TouchableOpacity
                    style={[styles.pathChip, isDark && styles.pathChipDark]}
                    onPress={() => setCustomDir(serverHome)}
                  >
                    <Text style={[styles.pathChipText, isDark && styles.pathChipTextDark]}>~</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pathChip, isDark && styles.pathChipDark]}
                    onPress={() => setCustomDir(serverHome + "/")}
                  >
                    <Text style={[styles.pathChipText, isDark && styles.pathChipTextDark]}>~/</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              {customDir.trim() ? (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    isDark && styles.modalButtonPrimaryDark,
                    styles.modalButtonFull,
                  ]}
                  onPress={() => onCreateInDirectory(customDir)}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={T.accentInk} />
                  ) : (
                    <Text style={[styles.modalButtonTextPrimary, isDark && styles.modalButtonTextPrimaryDark]}>
                      {t("sessionsList.newSessionModal.createInButton", {
                        dir: customDir.split("/").filter(Boolean).pop() || customDir,
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonPrimary,
                    isDark && styles.modalButtonPrimaryDark,
                    styles.modalButtonFull,
                  ]}
                  onPress={() => onCreateInDirectory()}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={T.accentInk} />
                  ) : (
                    <Text style={[styles.modalButtonTextPrimary, isDark && styles.modalButtonTextPrimaryDark]}>
                      {t("sessionsList.newSessionModal.createSessionButton")}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Model chooser — nested native Modal so it layers above the New
            Session modal (bottom-sheet portals cannot do that). Selecting a
            model stores it in the global catalog; the session created next
            prompts with it (the first prompt POSTs the session switch). */}
        <ModelPickerModal
          visible={showModelPicker}
          providers={catalogProviders}
          selected={catalogModel}
          isDark={isDark}
          onClose={() => setShowModelPicker(false)}
          onSelect={(providerID, modelID) => {
            setCatalogModel({ providerID, modelID })
            setShowModelPicker(false)
          }}
          onClear={() => {
            setCatalogModel(null)
            setShowModelPicker(false)
          }}
        />
      </Modal>

      {/* Rename modal */}
      <Modal visible={!!renaming} animationType="fade" transparent onRequestClose={() => setRenaming(null)}>
        <View
          style={[styles.modalOverlay, { justifyContent: "center" }, { paddingBottom: kbHeight }]}
        >
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setRenaming(null)} />
          <View style={[styles.renameCard, isDark && styles.renameCardDark]}>
            <Text style={[styles.renameTitle, isDark && styles.textDark]}>{t("sessionsList.renameModal.title")}</Text>
            <TextInput
              style={[styles.modalInput, isDark && styles.modalInputDark]}
              value={renameText}
              onChangeText={setRenameText}
              onSubmitEditing={submitRename}
              returnKeyType="done"
              autoFocus
              selectTextOnFocus
              autoCapitalize="sentences"
              autoCorrect={false}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity style={[styles.renameBtn, styles.renameBtnCancel]} onPress={() => setRenaming(null)}>
                <Text style={styles.renameBtnCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameBtn, styles.modalButtonPrimary, isDark && styles.modalButtonPrimaryDark]}
                onPress={submitRename}
                disabled={!renameText.trim()}
              >
                <Text style={[styles.modalButtonTextPrimary, isDark && styles.modalButtonTextPrimaryDark]}>
                  {t("common.save")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.modalDismiss} activeOpacity={1} onPress={() => setRenaming(null)} />
        </View>
      </Modal>

      {/* Directory switcher bottom sheet */}
      <DirectorySwitcher
        sheetRef={dirSheetRef}
        current={activeConnection?.directory}
        recents={recentDirectories}
        serverHome={serverHome}
        isDark={isDark}
        onSwitch={handleSwitchDirectory}
        onBrowse={() =>
          openBrowser(activeConnection?.directory || currentProject?.path?.absolute || null, "switch")
        }
      />

      {/* Browsable folder picker — used for both "new session in..." and
          "switch project directory" flows (see browseMode). */}
      <DirectoryBrowserSheet
        sheetRef={browserSheetRef}
        startDirectory={browseStartDir}
        clientForDirectory={clientForDirectory}
        isDark={isDark}
        onSelect={onBrowserSelect}
        onDismiss={onBrowserDismiss}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.paper,
  },
  containerDark: {
    backgroundColor: T.paper,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  statFigure: {
    fontFamily: T.mono,
    fontSize: 20,
    fontWeight: "400",
    color: T.ink,
  },
  statLabel: {
    fontFamily: T.mono,
    fontSize: 12,
    color: T.muted,
  },
  statRule: {
    width: 1,
    height: 14,
    backgroundColor: T.rule2,
    marginHorizontal: 6,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  historyRowText: {
    fontFamily: T.mono,
    fontSize: 13,
    color: T.ink2,
  },
  connectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  connectionBarDark: {
    borderBottomColor: T.rule,
  },
  connectionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 0,
  },
  connectionName: {
    fontSize: 14,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.mono,
  },
  connectionUrl: {
    fontSize: 12,
    color: T.muted,
    fontFamily: T.mono,
  },
  projectPath: {
    fontSize: 13,
    color: T.muted,
    flex: 1,
    fontFamily: T.mono,
  },
  errorBar: {
    backgroundColor: T.accentWash,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  errorText: {
    color: T.ink2,
    fontSize: 14,
    fontFamily: T.mono,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T.paper2,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  groupHeaderDark: {
    backgroundColor: T.paper2,
    borderBottomColor: T.rule,
  },
  groupHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.mono,
  },
  groupHeaderCount: {
    fontSize: 12,
    color: T.muted,
    fontFamily: T.mono,
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  sessionItemDark: {
    borderBottomColor: T.rule,
  },
  sessionContent: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: T.ink,
    marginBottom: 4,
    fontFamily: T.mono,
  },
  textDark: {
    color: T.ink,
    fontFamily: T.mono,
  },
  sessionMeta: {
    fontSize: 13,
    color: T.muted,
    fontFamily: T.mono,
  },
  sessionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionDirBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: T.accentWash,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 0,
  },
  sessionDirText: {
    fontSize: 11,
    color: T.muted,
    fontFamily: T.mono,
  },
  metaDark: {
    color: T.muted,
    fontFamily: T.mono,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: T.paper,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    color: T.ink,
    fontFamily: T.mono,
  },
  emptySubtitle: {
    fontSize: 14,
    color: T.muted,
    marginTop: 8,
    textAlign: "center",
    fontFamily: T.mono,
  },
  addButton: {
    backgroundColor: T.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 0,
    marginTop: 24,
  },
  authErrorButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  addButtonDark: {
    backgroundColor: T.accent,
  },
  addButtonText: {
    color: T.accentInk,
    fontWeight: "600",
    fontFamily: T.mono,
  },
  addButtonTextDark: {
    color: T.accentInk,
    fontFamily: T.mono,
  },
  setupGuideLink: {
    marginTop: 16,
  },
  setupGuideLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: T.accent,
    fontFamily: T.mono,
  },
  tryDemoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: T.accent,
  },
  tryDemoButtonDark: {
    borderColor: T.accent,
  },
  tryDemoButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: T.accent,
    fontFamily: T.mono,
  },
  tryDemoButtonTextDark: {
    color: T.accent,
    fontFamily: T.mono,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyListText: {
    fontSize: 16,
    color: T.muted,
    fontFamily: T.mono,
  },
  emptyContent: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: T.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  fabDark: {
    backgroundColor: T.accent,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: T.overlay,
    justifyContent: "flex-end",
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: T.paper,
    borderTopWidth: 1,
    borderTopColor: T.rule2,
    padding: 20,
    paddingBottom: 40,
  },
  modalContentDark: {
    backgroundColor: T.paper2,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.mono,
  },
  modalBody: {
    marginBottom: 24,
  },
  modalScrollBody: {
    maxHeight: 420,
    marginBottom: 16,
  },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 0,
    backgroundColor: T.paper2,
    marginBottom: 6,
  },
  projectRowDark: {
    backgroundColor: T.paper3,
  },
  projectRowActive: {
    backgroundColor: T.accentWash,
  },
  projectRowContent: {
    flex: 1,
  },
  projectRowName: {
    fontSize: 14,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.mono,
  },
  projectRowNameActive: {
    color: T.accent,
    fontFamily: T.mono,
  },
  projectRowPath: {
    fontSize: 11,
    color: T.muted,
    marginTop: 1,
    fontFamily: T.mono,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: T.muted,
    marginBottom: 8,

    fontFamily: T.mono,
  },
  modalDirBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: T.paper2,
    padding: 16,
    borderRadius: 0,
  },
  modalDirBoxDark: {
    backgroundColor: T.paper3,
  },
  modalDirText: {
    fontSize: 15,
    color: T.ink,
    flex: 1,
    fontFamily: T.mono,
  },
  modalInput: {
    backgroundColor: T.paper2,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: T.ink,
    fontFamily: T.mono,
  },
  modalInputDark: {
    backgroundColor: T.paper3,
    color: T.ink,
    fontFamily: T.mono,
  },
  pathChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  pathChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: T.accentWash,
    borderRadius: 0,
  },
  pathChipDark: {
    backgroundColor: T.accentWash,
  },
  pathChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: T.accent,
    fontFamily: T.mono,
  },
  pathChipTextDark: {
    color: T.accent,
    fontFamily: T.mono,
  },
  modalHint: {
    fontSize: 13,
    color: T.muted,
    marginTop: 12,
    fontFamily: T.mono,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 0,
  },
  modalButtonSecondary: {
    borderWidth: 1,
    borderColor: T.rule2,
  },
  modalButtonSecondaryDark: {
    borderWidth: 1,
    borderColor: T.rule2,
  },
  modalButtonPrimary: {
    backgroundColor: T.accent,
  },
  modalButtonPrimaryDark: {
    backgroundColor: T.accent,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.mono,
  },
  modalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: "600",
    color: T.accentInk,
    fontFamily: T.mono,
  },
  modalButtonTextPrimaryDark: {
    color: T.accentInk,
    fontFamily: T.mono,
  },
  modalButtonFull: {
    flex: 0,
    width: "100%",
  },
  // Rename modal
  renameCard: {
    backgroundColor: T.paper,
    borderRadius: 0,
    padding: 20,
    marginHorizontal: 32,
    gap: 16,
  },
  renameCardDark: {
    backgroundColor: T.paper2,
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.mono,
  },
  renameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  renameBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 0,
  },
  renameBtnCancel: {
    backgroundColor: "transparent",
  },
  renameBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: T.muted,
    fontFamily: T.mono,
  },
})
