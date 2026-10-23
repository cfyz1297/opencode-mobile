import * as SecureStore from 'expo-secure-store'
import { createHistory } from './offline-history'

export const offlineHistory = createHistory({
  get: key => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  remove: key => SecureStore.deleteItemAsync(key),
})

export async function historyEnabled(): Promise<boolean> {
  return offlineHistory.enabled()
}
export async function setHistoryEnabled(enabled: boolean): Promise<void> {
  await offlineHistory.setEnabled(enabled)
}
