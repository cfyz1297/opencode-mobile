import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, Switch, Alert, useColorScheme, ActivityIndicator } from 'react-native'
import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useConnections } from '../src/stores/connections'
import { historyEnabled, setHistoryEnabled, offlineHistory } from '../src/lib/history-storage'
import type { SavedSession } from '../src/lib/offline-history'

export default function HistoryScreen() {
  const { t } = useTranslation(), dark = useColorScheme() === 'dark'
  const connections = useConnections(s => s.connections), active = useConnections(s => s.activeConnection?.id)
  const [enabled, setEnabled] = useState(false), [sessions, setSessions] = useState<SavedSession[]>([])
  const [selected, setSelected] = useState<SavedSession | null>(null), [busy, setBusy] = useState(true)
  const fg = dark ? '#fff' : '#111'
  const request = useRef(0)
  const currentConnection = useRef(active)
  currentConnection.current = active
  const reload = useCallback(async () => {
    const sequence = ++request.current
    setBusy(true)
    try {
      const [consent, saved] = await Promise.all([historyEnabled(), active ? offlineHistory.list(active) : Promise.resolve([])])
      if (sequence !== request.current || currentConnection.current !== active) return
      setEnabled(consent)
      setSessions(saved)
    } catch { if (sequence === request.current && currentConnection.current === active) Alert.alert(t('common.error'), t('history.failed')) }
    finally { if (sequence === request.current && currentConnection.current === active) setBusy(false) }
  }, [active, t])
  useEffect(() => { setSelected(null); setSessions([]); void reload() }, [reload])
  const clear = () => Alert.alert(t('history.clear'), t('history.confirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: () => {
      void (async () => {
        try {
          // Disable capture before clearing so a scheduled SSE save cannot
          // recreate a transcript after the user removes local history.
          await setHistoryEnabled(false)
          for (const connection of connections) await offlineHistory.clear(connection.id)
          setSelected(null); await reload()
        } catch { Alert.alert(t('common.error'), t('history.failed')) }
      })()
    } },
  ])
  return <ScrollView style={{ flex: 1, backgroundColor: dark ? '#0a0a0a' : '#fff' }} contentContainerStyle={{ padding: 20, maxWidth: 1000, width: '100%', alignSelf: 'center', gap: 16 }}>
    <Stack.Screen options={{ title: t('history.title') }} />
    <Text style={{ color: fg }}>{t('history.privacy')}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: fg, flex: 1 }}>{t('history.enable')}</Text>
      <Switch testID="history-enable" accessibilityLabel={t('history.enable')} value={enabled} onValueChange={value => {
        void setHistoryEnabled(value).then(() => setEnabled(value)).catch(() => Alert.alert(t('common.error'), t('history.failed')))
      }} />
    </View>
    <Text style={{ color: fg, fontWeight: '700' }}>{connections.find(c => c.id === active)?.name ?? t('history.noConnection')}</Text>
    <Pressable accessibilityRole="button" testID="history-refresh" onPress={() => { void reload() }} style={{ padding: 14, backgroundColor: dark ? '#222' : '#eee', borderRadius: 8 }}><Text style={{ color: fg }}>{t('common.retry')}</Text></Pressable>
    <Pressable accessibilityRole="button" testID="history-clear" onPress={clear} style={{ padding: 14, backgroundColor: dark ? '#222' : '#eee', borderRadius: 8 }}><Text style={{ color: dark ? '#fca5a5' : '#b91c1c' }}>{t('history.clear')}</Text></Pressable>
    {busy && <ActivityIndicator />}
    {!busy && !sessions.length && <Text style={{ color: fg }}>{t('history.empty')}</Text>}
    {selected ? <>
      <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={{ padding: 14 }}><Text style={{ color: fg }}>← {t('history.title')}</Text></Pressable>
      <Text selectable style={{ color: fg, fontSize: 22, fontWeight: '700' }}>{selected.title}</Text>
      <Text style={{ color: fg }}>{t('history.savedAt', { date: new Date(selected.savedAt).toLocaleString() })}</Text>
      <Text style={{ color: fg }}>{t('history.readOnly')}</Text>
      {selected.messages.map((message, i) => <View key={`${message.id}-${i}`} style={{ padding: 16, gap: 8, borderRadius: 10, backgroundColor: dark ? '#222' : '#eee' }}>
        <Text style={{ color: fg, fontWeight: '700' }}>{message.role === 'user' ? t('history.user') : t('history.assistant')}</Text>
        <Text selectable testID="history-message" style={{ color: fg, fontSize: 16, lineHeight: 24 }}>{message.text}</Text>
      </View>)}
    </> : sessions.map(session => <Pressable key={session.id} testID={`history-session-${session.id}`} accessibilityRole="button" onPress={() => setSelected(session)} style={{ padding: 16, gap: 6, borderWidth: 1, borderColor: dark ? '#555' : '#aaa', borderRadius: 10 }}>
      <Text style={{ color: fg, fontWeight: '700' }}>{session.title}</Text>
      <Text style={{ color: fg }}>{session.directory}</Text>
      <Text style={{ color: fg }}>{t('history.savedAt', { date: new Date(session.savedAt).toLocaleString() })}</Text>
    </Pressable>)}
  </ScrollView>
}
