import * as SecureStore from 'expo-secure-store'
import { createHistory } from './offline-history'

export const offlineHistory = createHistory({
  get: key => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  remove: key => SecureStore.deleteItemAsync(key),
})

const HISTORY_ENABLED_KEY = 'opencode_history_enabled'
export async function historyEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(HISTORY_ENABLED_KEY)) === 'true'
}
export async function setHistoryEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(HISTORY_ENABLED_KEY, String(enabled))
}
