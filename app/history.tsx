import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, Switch, Alert, ActivityIndicator } from 'react-native'
import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useConnections } from '../src/stores/connections'
import { historyEnabled, setHistoryEnabled, offlineHistory } from '../src/lib/history-storage'
import type { SavedSession } from '../src/lib/offline-history'
import { T } from "../src/theme/tokens"

export default function HistoryScreen() {
  const { t } = useTranslation()
  const connections = useConnections(s => s.connections), active = useConnections(s => s.activeConnection?.id)
  const [enabled, setEnabled] = useState(false)
  const [saved, setSaved] = useState<{ connection: string | undefined; sessions: SavedSession[] }>({ connection: undefined, sessions: [] })
  const [selection, setSelection] = useState<{ connection: string | undefined; session: SavedSession } | null>(null)
  const [busy, setBusy] = useState(true)
  const sessions = saved.connection === active ? saved.sessions : []
  const selected = selection?.connection === active ? selection?.session : null
  const setSelected = (session: SavedSession | null) => setSelection(session ? { connection: active, session } : null)
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
      setSaved({ connection: active, sessions: saved })
    } catch { if (sequence === request.current && currentConnection.current === active) Alert.alert(t('common.error'), t('history.failed')) }
    finally { if (sequence === request.current && currentConnection.current === active) setBusy(false) }
  }, [active, t])
  useEffect(() => {
    setSelection(null)
    setSaved({ connection: active, sessions: [] })
    void reload()
    return () => { request.current++ }
  }, [reload])
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
  return <ScrollView style={{ flex: 1, backgroundColor: T.paper }} contentContainerStyle={{ padding: 20, maxWidth: 1000, width: '100%', alignSelf: 'center', gap: 16 }}>
    <Stack.Screen options={{ title: t('history.title') }} />
    <Text style={{ color: T.ink, fontFamily: T.font }}>{t('history.privacy')}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: T.ink, flex: 1, fontFamily: T.font }}>{t('history.enable')}</Text>
      <Switch testID="history-enable" trackColor={{ false: T.paper3, true: T.accent }} thumbColor={T.ink} accessibilityLabel={t('history.enable')} value={enabled} onValueChange={value => {
        void setHistoryEnabled(value).then(() => setEnabled(value)).catch(() => Alert.alert(t('common.error'), t('history.failed')))
      }} />
    </View>
    <Text style={{ color: T.ink, fontWeight: '700', fontFamily: T.font }}>{connections.find(c => c.id === active)?.name ?? t('history.noConnection')}</Text>
    <Pressable accessibilityRole="button" testID="history-refresh" onPress={() => { void reload() }} style={{ padding: 14, borderWidth: 1, borderColor: T.rule2 }}><Text style={{ color: T.ink, fontFamily: T.font }}>{t('common.retry')}</Text></Pressable>
    <Pressable accessibilityRole="button" testID="history-clear" onPress={clear} style={{ padding: 14, borderWidth: 1, borderColor: T.rule2 }}><Text style={{ color: T.ink, fontFamily: T.font }}>{t('history.clear')}</Text></Pressable>
    {busy && <ActivityIndicator />}
    {!busy && !sessions.length && <Text style={{ color: T.ink, fontFamily: T.font }}>{t('history.empty')}</Text>}
    {selected ? <>
      <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={{ padding: 14 }}><Text style={{ color: T.ink, fontFamily: T.font }}>← {t('history.title')}</Text></Pressable>
      <Text selectable style={{ color: T.ink, fontSize: 22, fontWeight: '700', fontFamily: T.font }}>{selected.title}</Text>
      <Text style={{ color: T.ink, fontFamily: T.font }}>{t('history.savedAt', { date: new Date(selected.savedAt).toLocaleString() })}</Text>
      <Text style={{ color: T.ink, fontFamily: T.font }}>{t('history.readOnly')}</Text>
      {selected.messages.map((message, i) => <View key={`${message.id}-${i}`} style={{ padding: 16, gap: 8, borderRadius: T.radius, backgroundColor: T.paper3 }}>
        <Text style={{ color: T.ink, fontWeight: '700', fontFamily: T.font }}>{message.role === 'user' ? t('history.user') : t('history.assistant')}</Text>
        <Text selectable testID="history-message" style={{ color: T.ink, fontSize: 16, lineHeight: 24, fontFamily: T.font }}>{message.text}</Text>
      </View>)}
    </> : sessions.map(session => <Pressable key={session.id} testID={`history-session-${session.id}`} accessibilityRole="button" onPress={() => setSelected(session)} style={{ padding: 16, gap: 6, borderBottomWidth: 1, borderBottomColor: T.rule }}>
      <Text style={{ color: T.ink, fontWeight: '700', fontFamily: T.font }}>{session.title}</Text>
      <Text style={{ color: T.ink, fontFamily: T.font }}>{session.directory}</Text>
      <Text style={{ color: T.ink, fontFamily: T.font }}>{t('history.savedAt', { date: new Date(session.savedAt).toLocaleString() })}</Text>
    </Pressable>)}
  </ScrollView>
}
