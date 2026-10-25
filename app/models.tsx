import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, View, Text, TextInput, SectionList, Switch, StyleSheet, useColorScheme, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Stack, router, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useCatalog } from '../src/stores/catalog'
import { useConnections } from '../src/stores/connections'
import { useModelVisibility } from '../src/stores/model-visibility'
import { modelKey } from '../src/lib/model-visibility'
import { buildModelPickerSections, type ModelPickerItem } from '../src/lib/model-picker-filter'
import { PROVIDERS_ROUTE } from '../src/lib/providers-ui'

export default function ModelsScreen() {
  const { t } = useTranslation()
  const dark = useColorScheme() === 'dark'
  const providers = useCatalog(s => s.providers)
  const catalogLoaded = useCatalog(s => s.loaded)
  const owner = useCatalog(s => s.catalogClient)
  const connection = useCatalog(s => s.catalogConnection)
  const scope = useConnections(s => s.activeConnection?.id)
  const client = useConnections(s => s.client)
  const { entries, loaded, error, load, setEnabled } = useModelVisibility()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    if (!client || !scope) return
    setRefreshing(true)
    try {
      await useCatalog.getState().load()
    } finally { setRefreshing(false) }
  }, [client, scope])
  useEffect(() => { void load() }, [load])
  useFocusEffect(useCallback(() => { void refresh() }, [refresh]))
  const sections = useMemo(() => buildModelPickerSections({ providers: client && owner === client && connection === scope ? providers : [], query, selected: null }), [providers, client, owner, connection, scope, query])
  const hidden = new Set(entries.find(([id]) => id === scope)?.[1] ?? [])
  const toggle = async (item: ModelPickerItem, enabled: boolean) => {
    if (!scope || !loaded || busy) return
    setBusy(true)
    try { await setEnabled(scope, item.providerID, item.modelID, enabled) }
    catch { Alert.alert(t('common.error'), t('models.saveError')) }
    finally { setBusy(false) }
  }
  const color = dark ? '#ffffff' : '#111111'
  return <View style={[styles.container, { backgroundColor: dark ? '#0a0a0a' : '#ffffff' }]}>
    <Stack.Screen options={{ title: t('models.title') }} />
    <Text style={styles.description}>{t('models.description')}</Text>
    <TextInput style={[styles.search, { color, backgroundColor: dark ? '#232323' : '#f2f2f2' }]} value={query} onChangeText={setQuery} placeholder={t('models.search')} placeholderTextColor='#888888' accessibilityLabel={t('models.search')} testID='models-search' />
    {error && <TouchableOpacity onPress={() => void load()} accessibilityRole='button'><Text style={styles.error}>{t('models.loadError')}</Text></TouchableOpacity>}
    {!loaded && !error && <ActivityIndicator accessibilityLabel={t('common.loading')} />}
    <SectionList sections={sections} keyExtractor={item => modelKey(item.providerID, item.modelID)} refreshing={refreshing} onRefresh={refresh} keyboardShouldPersistTaps='handled' contentContainerStyle={styles.content}
      renderSectionHeader={({ section }) => <Text style={[styles.heading, { color, backgroundColor: dark ? '#0a0a0a' : '#ffffff' }]}>{section.title}</Text>}
      renderItem={({ item }) => <View style={[styles.row, { borderColor: dark ? '#333333' : '#eeeeee' }]}>
        <Text style={[styles.name, { color }]}>{item.modelName}</Text>
        <Switch value={!hidden.has(modelKey(item.providerID, item.modelID))} disabled={!loaded || busy || !scope || refreshing} onValueChange={value => void toggle(item, value)} accessibilityLabel={`${item.providerName}: ${item.modelName}`} trackColor={{ true: '#5365ff' }} />
      </View>}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.description}>{t(!client ? 'models.noServer' : !catalogLoaded || refreshing ? 'common.loading' : query.trim() ? 'models.noResults' : 'models.empty')}</Text><TouchableOpacity onPress={() => router.push(PROVIDERS_ROUTE)} accessibilityRole='button'><Text style={styles.link}>{t('providers.title')}</Text></TouchableOpacity></View>}
    />
  </View>
}

const styles = StyleSheet.create({
  container: { flex: 1 }, description: { color: '#888888', fontSize: 14, padding: 16 },
  search: { marginHorizontal: 16, marginBottom: 12, borderRadius: 10, padding: 12, fontSize: 16 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  heading: { fontSize: 16, fontWeight: '600', paddingVertical: 18 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, fontSize: 15, paddingRight: 12 }, empty: { paddingVertical: 20 },
  link: { color: '#5365ff', padding: 16 }, error: { color: '#d44', padding: 16 },
})
