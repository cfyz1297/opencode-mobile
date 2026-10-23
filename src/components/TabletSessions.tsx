import { ScrollView, Text, Pressable, useColorScheme } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSessions } from '../stores/sessions'

export function TabletSessions({ width, selected }: { width: number; selected: string }) {
  const { t } = useTranslation()
  const dark = useColorScheme() === 'dark'
  const sessions = useSessions(s => s.sessions)
  return <ScrollView testID="tablet-session-sidebar" style={{ width, flexGrow: 0, borderRightWidth: 1, borderRightColor: dark ? '#333' : '#ddd', backgroundColor: dark ? '#111' : '#f5f5f5' }}>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={{ padding: 20 }}>
      <Text style={{ color: dark ? '#fff' : '#111', fontWeight: '700', fontSize: 18 }}>{t('nav.sessionsTab')}</Text>
    </Pressable>
    {sessions.map(session => <Pressable key={session.id} accessibilityRole="button" accessibilityState={{ selected: selected === session.id }} onPress={() => router.replace({ pathname: '/session/[id]', params: { id: session.id, directory: session.directory } })} style={{ padding: 16, minHeight: 56, backgroundColor: selected === session.id ? (dark ? '#233047' : '#dbeafe') : 'transparent' }}>
      <Text numberOfLines={2} style={{ color: dark ? '#fff' : '#111' }}>{session.title || t('sessionsList.untitledSession')}</Text>
      <Text numberOfLines={1} style={{ color: dark ? '#aaa' : '#555', marginTop: 6 }}>{session.directory}</Text>
    </Pressable>)}
  </ScrollView>
}
