import { useState, useCallback } from "react"
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme, Alert, AppState } from "react-native"
import { router, useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useConnections } from "../../src/stores/connections"
import { useSettings } from "../../src/stores/settings"
import { probeConnection, type ConnectionHealth } from "../../src/lib/connection-health"
import type { ServerConnection } from "../../src/lib/types"

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
          size={24}
          color={offline ? "#ef4444" : online ? "#22c55e" : isDark ? "#888888" : "#666666"}
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
        <Ionicons name="ellipsis-vertical" size={20} color={isDark ? "#666666" : "#999999"} />
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
            <Ionicons name="server-outline" size={64} color={isDark ? "#444444" : "#cccccc"} />
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
                <Ionicons name="layers-outline" size={18} color={isDark ? "#888888" : "#666666"} />
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
        <Ionicons name="add" size={28} color={isDark ? "#0a0a0a" : "#ffffff"} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  containerDark: {
    backgroundColor: "#0a0a0a",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  headerDark: {
    borderBottomColor: "#1a1a1a",
  },
  headerText: {
    fontSize: 13,
    color: "#666666",
  },
  connectionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  connectionItemDark: {
    borderBottomColor: "#1a1a1a",
  },
  connectionItemActive: {
    backgroundColor: "#f0fdf4",
  },
  connectionItemActiveDark: {
    backgroundColor: "#1a2e1a",
  },
  connectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5f5f5",
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
    color: "#0a0a0a",
  },
  connectionNameActive: {
    color: "#0a0a0a",
  },
  connectionNameActiveDark: {
    color: "#ffffff",
  },
  textDark: {
    color: "#ffffff",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  activeBadge: {
    backgroundColor: "#22c55e",
  },
  activeBadgeDark: {
    backgroundColor: "#16a34a",
  },
  activeBadgeText: {
    color: "#ffffff",
  },
  activeBadgeTextDark: {
    color: "#ffffff",
  },
  offlineBadge: {
    backgroundColor: "#dc2626",
  },
  offlineBadgeDark: {
    backgroundColor: "#b91c1c",
  },
  offlineBadgeText: {
    color: "#ffffff",
  },
  offlineBadgeTextDark: {
    color: "#ffffff",
  },
  checkingBadge: {
    backgroundColor: "#e5e5e5",
  },
  checkingBadgeDark: {
    backgroundColor: "#333333",
  },
  checkingBadgeText: {
    color: "#666666",
  },
  checkingBadgeTextDark: {
    color: "#aaaaaa",
  },
  connectionUrl: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  connectionUrlActive: {
    color: "#888888",
  },
  connectionMeta: {
    fontSize: 12,
    color: "#999999",
    marginTop: 4,
  },
  metaDark: {
    color: "#888888",
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
    color: "#0a0a0a",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666666",
    marginTop: 8,
    textAlign: "center",
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
    borderRadius: 28,
    backgroundColor: "#0a0a0a",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabDark: {
    backgroundColor: "#ffffff",
  },
  settingsSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    marginTop: 16,
    gap: 10,
  },
  settingsSectionDark: {
    borderTopColor: "#1a1a1a",
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0a0a0a",
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
    color: "#0a0a0a",
  },
  pagePicker: {
    flexDirection: "row",
    gap: 6,
  },
  pageOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#f5f5f5",
  },
  pageOptionDark: {
    borderColor: "#2a2a2a",
    backgroundColor: "#1a1a1a",
  },
  pageOptionActive: {
    backgroundColor: "#0a0a0a",
    borderColor: "#0a0a0a",
  },
  pageOptionActiveDark: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  pageOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666666",
  },
  pageOptionTextActive: {
    color: "#ffffff",
  },
  settingHint: {
    fontSize: 12,
    color: "#999999",
  },
})
