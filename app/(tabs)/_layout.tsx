import { Tabs } from "expo-router"
import { useWindowDimensions } from "react-native"
import { adaptiveLayout } from '../../src/lib/adaptive-layout'
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { T } from "../../src/theme/tokens"

export default function TabLayout() {
  const { t } = useTranslation()
  const layout = adaptiveLayout(useWindowDimensions().width)

  return (
    <Tabs
      screenOptions={{
        tabBarPosition: layout.tablet ? 'left' : 'bottom',
        tabBarLabelPosition: layout.tablet ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: T.accent,
        tabBarInactiveTintColor: T.muted,
        tabBarStyle: {
          backgroundColor: T.paper2,
          borderTopColor: T.rule,
          borderTopWidth: T.hair,
        },
        tabBarLabelStyle: {
          fontFamily: T.font,
          fontSize: 11,
        },
        headerStyle: {
          backgroundColor: T.paper,
          borderBottomColor: T.rule,
          borderBottomWidth: T.hair,
        },
        headerTitleStyle: {
          fontFamily: T.font,
          fontSize: 15,
          fontWeight: "500",
        },
        headerTintColor: T.ink,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.sessionsTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="terminal-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: t("nav.connectionsTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="server-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("nav.settingsTab"),
          tabBarIcon: ({ color, size }) => <Ionicons name="options-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
