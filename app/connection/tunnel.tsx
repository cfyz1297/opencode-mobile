import { useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, Linking, useColorScheme } from 'react-native'
import { Stack, router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { tunnelCommands, tunnelUrl, type TunnelProvider, type HostPlatform } from '../../src/lib/tunnel'
import { useConnections } from '../../src/stores/connections'
import { useKeyboardHeight } from '../../src/lib/use-keyboard-height'

export default function TunnelScreen() {
  const { t } = useTranslation()
  const dark = useColorScheme() === 'dark', kb = useKeyboardHeight()
  const [provider, setProvider] = useState<TunnelProvider>('cloudflare')
  const [platform, setPlatform] = useState<HostPlatform>('windows')
  const [port, setPort] = useState('4096'), [url, setUrl] = useState('')
  const [username, setUsername] = useState('opencode'), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false), [step, setStep] = useState(1)
  const guard = useRef(false)
  const fg = dark ? '#fff' : '#111'
  let commands: string[] = []
  try { commands = tunnelCommands(provider, port, platform) } catch { /* Invalid port is shown inline. */ }
  const button = (label: string, action: () => void, id?: string) => <Pressable testID={id} accessibilityRole="button" disabled={busy} onPress={action} style={{ padding: 14, marginVertical: 6, borderRadius: 10, backgroundColor: dark ? '#26344d' : '#dbeafe', minHeight: 48 }}><Text style={{ color: fg }}>{label}</Text></Pressable>
  async function connect() {
    if (guard.current) return
    try {
      const target = tunnelUrl(url)
      if (!password.trim()) throw new Error(t('tunnel.passwordRequired'))
      guard.current = true
      setBusy(true)
      const store = useConnections.getState()
      const connection = { name: `${provider === 'cloudflare' ? 'Cloudflare' : 'ngrok'} tunnel`, type: 'tunnel' as const, url: target, username: username.trim() || 'opencode' }
      const result = await store.testConnection({ ...connection, id: '' }, 'onboarding', password)
      if (!result.ok) throw new Error(t('tunnel.failed'))
      await store.addConnection(connection, password)
      const added = useConnections.getState().connections.at(-1)
      if (added && !added.active) await store.setActiveConnection(added.id)
      router.replace('/(tabs)/connections')
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('tunnel.failed'))
    } finally { guard.current = false; setBusy(false) }
  }
  return <View style={{ flex: 1, paddingBottom: kb, backgroundColor: dark ? '#0a0a0a' : '#fff' }}>
    <Stack.Screen options={{ title: t('tunnel.title') }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, width: '100%', maxWidth: 720, alignSelf: 'center', gap: 12 }}>
      <Text style={{ color: fg, fontSize: 22, fontWeight: '700' }}>{t('tunnel.step', { step })}</Text>
      {step === 1 && <>
        <Text style={{ color: fg }}>{t('tunnel.intro')}</Text>
        {button(`${provider === 'cloudflare' ? '✓ ' : ''}Cloudflare`, () => setProvider('cloudflare'), 'tunnel-cloudflare')}
        {button(`${provider === 'ngrok' ? '✓ ' : ''}ngrok`, () => setProvider('ngrok'), 'tunnel-ngrok')}
        {button(platform === 'windows' ? '✓ Windows (PowerShell)' : 'Windows (PowerShell)', () => setPlatform('windows'))}
        {button(platform === 'unix' ? '✓ macOS / Linux' : 'macOS / Linux', () => setPlatform('unix'))}
        {button(t('tunnel.install'), () => { void Linking.openURL(provider === 'cloudflare' ? 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/' : 'https://ngrok.com/docs/getting-started/').catch(() => Alert.alert(t('common.error'), t('tunnel.failed'))) })}
        {button(t('tunnel.next'), () => setStep(2), 'tunnel-next')}
      </>}
      {step === 2 && <>
        <Text style={{ color: fg }}>{t('tunnel.start')}</Text>
        <Text style={{ color: fg }}>{t('tunnel.port')}</Text>
        <TextInput accessibilityLabel={t('tunnel.port')} value={port} onChangeText={setPort} keyboardType="number-pad" style={{ padding: 14, color: fg, borderWidth: 1, borderColor: '#888', borderRadius: 8 }} />
        {!commands.length && <Text style={{ color: '#ef4444' }}>{t('tunnel.invalidPort')}</Text>}
        {commands.map((command, i) => <View key={i} style={{ gap: 6 }}>
          <Text selectable style={{ color: fg, fontFamily: 'monospace', padding: 12, backgroundColor: dark ? '#222' : '#eee' }}>{command}</Text>
          {button(t('tunnel.copy', { number: i + 1 }), () => { void Clipboard.setStringAsync(command) })}
        </View>)}
        <Text style={{ color: fg }}>{t('tunnel.warning')}</Text>
        {button(t('tunnel.back'), () => setStep(1))}
        {commands.length > 0 && button(t('tunnel.next'), () => setStep(3), 'tunnel-next')}
      </>}
      {step === 3 && <>
        <Text style={{ color: fg }}>{t('tunnel.paste')}</Text>
        {[{ label: t('tunnel.url'), value: url, set: setUrl, secret: false }, { label: t('tunnel.username'), value: username, set: setUsername, secret: false }, { label: t('tunnel.password'), value: password, set: setPassword, secret: true }].map(field => <View key={field.label}>
          <Text style={{ color: fg, marginBottom: 6 }}>{field.label}</Text>
          <TextInput testID={field.secret ? 'tunnel-password' : field.set === setUrl ? 'tunnel-url' : 'tunnel-username'} accessibilityLabel={field.label} value={field.value} onChangeText={field.set} secureTextEntry={field.secret} autoCapitalize="none" autoCorrect={false} editable={!busy} style={{ padding: 14, color: fg, borderWidth: 1, borderColor: '#888', borderRadius: 8 }} />
        </View>)}
        {busy && <ActivityIndicator />}
        {button(t('tunnel.connect'), () => { void connect() }, 'tunnel-connect')}
        {button(t('tunnel.back'), () => setStep(2))}
      </>}
    </ScrollView>
  </View>
}
