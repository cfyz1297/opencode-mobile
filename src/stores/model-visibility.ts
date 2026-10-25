import { useEffect } from 'react'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createModelVisibility, type HiddenModels } from '../lib/model-visibility'
import { useConnections } from './connections'
import { useCatalog } from './catalog'

interface State {
  entries: HiddenModels
  loaded: boolean
  error: boolean
  load: () => Promise<void>
  setEnabled: (scope: string, provider: string, model: string, enabled: boolean) => Promise<void>
}

export const useModelVisibility = create<State>((set) => {
  const controller = createModelVisibility(AsyncStorage, entries => set({ entries }))
  return {
    entries: [], loaded: false, error: false,
    load: async () => {
      try {
        await controller.load()
        set({ loaded: true, error: false })
      } catch {
        set({ error: true })
      }
    },
    setEnabled: (scope, provider, model, enabled) => controller.setEnabled(scope, provider, model, enabled),
  }
})

const EMPTY: string[] = []

/** Stable references, scoped to the selected server connection, for both model pickers. */
export function useHiddenModels() {
  const scope = useConnections(s => s.activeConnection?.id)
  const client = useConnections(s => s.client)
  const owner = useCatalog(s => s.catalogClient)
  const connection = useCatalog(s => s.catalogConnection)
  const entries = useModelVisibility(s => s.entries)
  const loaded = useModelVisibility(s => s.loaded)
  const load = useModelVisibility(s => s.load)
  useEffect(() => { void load() }, [load])
  return { hidden: entries.find(([id]) => id === scope)?.[1] ?? EMPTY, loaded: loaded && !!client && owner === client && connection === scope }
}
