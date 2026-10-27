import { ScrollView, Text, Pressable, useColorScheme } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSessions } from '../stores/sessions'
import { tabletSessionHref } from '../lib/tablet-session-nav'
import { T } from "../theme/tokens"

export function TabletSessions({ width, selected }: { width: number; selected: string }) {
  const { t } = useTranslation()
  const dark = useColorScheme() === 'dark'
  const sessions = useSessions(s => s.sessions)
  const openSession = (session: { id: string; directory?: string }) => {
    if (session.id === selected) return
    void useSessions.getState().selectSession(session.id, session.directory)
    router.replace(tabletSessionHref(session))
  }
  return <ScrollView testID="tablet-session-sidebar" style={{ width, flexGrow: 0, borderRightWidth: 1, borderRightColor: T.rule, backgroundColor: T.paper }}>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={{ padding: 20 }}>
      <Text style={{ color: T.ink, fontWeight: '700', fontSize: 18, fontFamily: T.font }}>{t('nav.sessionsTab')}</Text>
    </Pressable>
    {sessions.map(session => <Pressable key={session.id} testID={`tablet-session-${session.id}`} accessibilityRole="button" accessibilityState={{ selected: selected === session.id }} onPress={() => openSession(session)} style={{ padding: 16, minHeight: 56, backgroundColor: selected === session.id ? (T.paper2) : 'transparent' }}>
      <Text numberOfLines={2} style={{ color: T.ink, fontFamily: T.font }}>{session.title || t('sessionsList.untitledSession')}</Text>
      <Text numberOfLines={1} style={{ color: T.muted, marginTop: 6, fontFamily: T.font }}>{session.directory}</Text>
    </Pressable>)}
  </ScrollView>
}
