import { useState, useCallback } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme, Alert, AppState } from "react-native"
import { router, useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useConnections } from "../../src/stores/connections"
import { useSettings } from "../../src/stores/settings"
import { probeConnection, type ConnectionHealth } from "../../src/lib/connection-health"
import type { ServerConnection } from "../../src/lib/types"
import { T } from "../../src/theme/tokens"

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const
// Re-probe while the tab is open so a server started or stopped in Termux
// shows up without leaving and reopening the screen.
const PROBE_INTERVAL_MS = 15_000

function ConnectionItem({
  connection,
  isDark,
  isActive,
  health,
  onSelect,
  onEdit,
  onDelete,
}: {
  connection: ServerConnection
  isDark: boolean
  isActive: boolean
  health: ConnectionHealth | null
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const typeIcon = connection.type === "local" ? "wifi" : connection.type === "tunnel" ? "globe" : "cloud"
  const online = health === "online"
  const offline = health === "offline"
  const badge = offline
    ? {
        bg: isDark ? styles.offlineBadgeDark : styles.offlineBadge,
        text: isDark ? styles.offlineBadgeTextDark : styles.offlineBadgeText,
        label: t("connectionsList.offlineBadge"),
      }
    : online
      ? {
          bg: isDark ? styles.activeBadgeDark : styles.activeBadge,
          text: isDark ? styles.activeBadgeTextDark : styles.activeBadgeText,
          label: t("connectionsList.activeBadge"),
        }
      : {
          bg: isDark ? styles.checkingBadgeDark : styles.checkingBadge,
          text: isDark ? styles.checkingBadgeTextDark : styles.checkingBadgeText,
          label: t("connectionsList.checkingBadge"),
        }

  const handleLongPress = () => {
    Alert.alert(connection.name, t("connectionsList.actionsAlert.message"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("connectionsList.actionsAlert.edit"), onPress: onEdit },
      { text: t("common.delete"), style: "destructive", onPress: onDelete },
    ])
  }

  return (
    <TouchableOpacity
      style={[
        styles.connectionItem,
        isDark && styles.connectionItemDark,
        online && styles.connectionItemActive,
        online && isDark && styles.connectionItemActiveDark,
      ]}
      onPress={onSelect}
      onLongPress={handleLongPress}
    >
      <View style={styles.connectionIcon}>
        <Ionicons
          name={typeIcon}
          size={20}
          color={offline ? T.ink2 : online ? T.accent : T.muted}
        />
      </View>
      <View style={styles.connectionContent}>
        <View style={styles.connectionHeader}>
          <Text
            style={[
              styles.connectionName,
              isDark && styles.textDark,
              online && styles.connectionNameActive,
              online && isDark && styles.connectionNameActiveDark,
            ]}
          >
            {connection.name}
          </Text>
          {isActive && (
            <View style={[styles.badge, badge.bg]}>
              <Text style={[styles.badgeText, badge.text]}>{badge.label}</Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.connectionUrl, isDark && styles.metaDark, online && styles.connectionUrlActive]}
          numberOfLines={1}
        >
          {connection.url}
        </Text>
        {connection.lastConnected && (
          <Text style={[styles.connectionMeta, isDark && styles.metaDark]}>
            {t("connectionsList.lastConnected", { date: new Date(connection.lastConnected).toLocaleDateString() })}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={onEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={20} color={T.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

export default function ConnectionsScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const { t } = useTranslation()

  const { connections, activeConnection, setActiveConnection, removeConnection, client } = useConnections()
  const { pageSize, setPageSize } = useSettings()
  const [report, setReport] = useState<{ client: unknown; health: ConnectionHealth }>({
    client: null,
    health: "checking",
  })
  // A probe result belongs to the client it was taken from: switching servers
  // must not show the previous server's status.
  const health = report.client === client ? report.health : "checking"

  // Probe only while this tab is focused, so a backgrounded app stops asking.
  useFocusEffect(
    useCallback(() => {
      if (!client) {
        setReport({ client: null, health: "checking" })
        return
      }
      let cancelled = false
      let busy = false
      const check = async () => {
        if (busy) return
        busy = true
        try {
          const next = await probeConnection(client)
          if (!cancelled) setReport({ client, health: next })
        } finally {
          busy = false
        }
      }
      void check()
      const timer = setInterval(() => void check(), PROBE_INTERVAL_MS)
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void check()
      })
      return () => {
        cancelled = true
        clearInterval(timer)
        subscription.remove()
      }
    }, [client, activeConnection?.id]),
  )

  const handleDelete = (connection: ServerConnection) => {
    Alert.alert(
      t("connection.edit.alerts.deleteTitle"),
      t("connection.edit.alerts.deleteMessage", { name: connection.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => removeConnection(connection.id),
        },
      ],
    )
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConnectionItem
            connection={item}
            isDark={isDark}
            isActive={activeConnection?.id === item.id}
            health={activeConnection?.id === item.id ? health : null}
            onSelect={() => setActiveConnection(item.id)}
            onEdit={() => router.push(`/connection/${item.id}`)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="server-outline" size={64} color={T.ink} />
            <Text style={[styles.emptyTitle, isDark && styles.textDark]}>{t("connectionsList.empty.title")}</Text>
            <Text style={[styles.emptySubtitle, isDark && styles.metaDark]}>
              {t("connectionsList.empty.subtitle")}
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View style={[styles.header, isDark && styles.headerDark]}>
            <Text style={[styles.headerText, isDark && styles.metaDark]}>{t("connectionsList.header")}</Text>
          </View>
        }
        ListFooterComponent={
          <View style={[styles.settingsSection, isDark && styles.settingsSectionDark]}>
            <Text style={[styles.settingsTitle, isDark && styles.textDark]}>
              {t("connectionsList.preferences.title")}
            </Text>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="layers-outline" size={18} color={T.muted} />
                <Text style={[styles.settingText, isDark && styles.textDark]}>
                  {t("connectionsList.preferences.pageSizeLabel")}
                </Text>
              </View>
              <View style={styles.pagePicker}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.pageOption,
                      isDark && styles.pageOptionDark,
                      pageSize === size && styles.pageOptionActive,
                      pageSize === size && isDark && styles.pageOptionActiveDark,
                    ]}
                    onPress={() => setPageSize(size)}
                  >
                    <Text
                      style={[
                        styles.pageOptionText,
                        isDark && styles.metaDark,
                        pageSize === size && styles.pageOptionTextActive,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Text style={[styles.settingHint, isDark && styles.metaDark]}>
              {t("connectionsList.preferences.pageSizeHint")}
            </Text>
          </View>
        }
        contentContainerStyle={connections.length === 0 ? styles.emptyContent : undefined}
      />

      {/* FAB to add connection */}
      <TouchableOpacity style={[styles.fab, isDark && styles.fabDark]} onPress={() => router.push("/connection/add")}>
        <Ionicons name="add" size={28} color={T.accentInk} />
      </TouchableOpacity>
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  headerDark: {
    borderBottomColor: T.rule,
  },
  headerText: {
    fontSize: 13,
    color: T.muted,
    fontFamily: T.mono,
  },
  connectionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.rule,
  },
  connectionItemDark: {
    borderBottomColor: T.rule,
  },
  connectionItemActive: {
    backgroundColor: T.paper2,
  },
  connectionItemActiveDark: {
    backgroundColor: T.paper2,
  },
  connectionIcon: {
    width: 24,
    borderRadius: 0,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  connectionContent: {
    flex: 1,
  },
  connectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: "600",
    color: T.ink,
    fontFamily: T.mono,
  },
  connectionNameActive: {
    color: T.ink,
    fontFamily: T.mono,
  },
  connectionNameActiveDark: {
    color: T.ink,
    fontFamily: T.mono,
  },
  textDark: {
    color: T.ink,
    fontFamily: T.mono,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: T.mono,
  },
  activeBadge: {
    backgroundColor: T.accentWash,
  },
  activeBadgeDark: {
    backgroundColor: T.accentWash,
  },
  activeBadgeText: {
    color: T.accent,
    fontFamily: T.mono,
  },
  activeBadgeTextDark: {
    color: T.accent,
    fontFamily: T.mono,
  },
  offlineBadge: {
    backgroundColor: T.paper3,
  },
  offlineBadgeDark: {
    backgroundColor: T.paper2,
  },
  offlineBadgeText: {
    color: T.ink,
    fontFamily: T.mono,
  },
  offlineBadgeTextDark: {
    color: T.ink,
    fontFamily: T.mono,
  },
  checkingBadge: {
    backgroundColor: T.accentWash,
  },
  checkingBadgeDark: {
    backgroundColor: T.accentWash,
  },
  checkingBadgeText: {
    color: T.accent,
    fontFamily: T.mono,
  },
  checkingBadgeTextDark: {
    color: T.accent,
    fontFamily: T.mono,
  },
  connectionUrl: {
    fontSize: 13,
    color: T.muted,
    marginTop: 2,
    fontFamily: T.mono,
  },
  connectionUrlActive: {
    color: T.muted,
    fontFamily: T.mono,
  },
  connectionMeta: {
    fontSize: 12,
    color: T.muted,
    marginTop: 4,
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
  settingsSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: T.rule,
    marginTop: 16,
    gap: 10,
  },
  settingsSectionDark: {
    borderTopColor: T.rule,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: T.ink,
    fontFamily: T.mono,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingText: {
    fontSize: 14,
    color: T.ink,
    fontFamily: T.mono,
  },
  pagePicker: {
    flexDirection: "row",
    gap: 6,
  },
  pageOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: T.rule,
    backgroundColor: T.accentWash,
  },
  pageOptionDark: {
    borderColor: T.rule,
    backgroundColor: T.paper2,
  },
  pageOptionActive: {
    backgroundColor: T.paper,
    borderColor: T.rule,
  },
  pageOptionActiveDark: {
    backgroundColor: T.paper3,
    borderColor: T.rule,
  },
  pageOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: T.accent,
    fontFamily: T.mono,
  },
  pageOptionTextActive: {
    color: T.ink,
    fontFamily: T.mono,
  },
  settingHint: {
    fontSize: 12,
    color: T.muted,
    fontFamily: T.mono,
  },
})
