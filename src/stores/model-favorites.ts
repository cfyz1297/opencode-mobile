import { useEffect } from 'react'
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createModelVisibility,
  FAVORITES_SCOPE,
  FAVORITES_STORAGE_KEY,
  modelKey,
  type HiddenModels,
} from '../lib/model-visibility'

// Favorites are global, not per connection: a model you like stays liked when
// you switch servers, and the picker is the only consumer.
interface State {
  keys: HiddenModels
  loaded: boolean
  load: () => Promise<void>
  toggle: (providerID: string, modelID: string) => Promise<void>
}

export const useModelFavorites = create<State>((set, get) => {
  const controller = createModelVisibility(
    AsyncStorage,
    keys => set({ keys }),
    FAVORITES_STORAGE_KEY,
  )
  return {
    keys: [],
    loaded: false,
    load: async () => {
      try {
        await controller.load()
        set({ loaded: true })
      } catch {
        // A read failure only costs the favorites section; the picker still works.
      }
    },
    toggle: async (providerID, modelID) => {
      const key = modelKey(providerID, modelID)
      const starred = get().keys.find(([scope]) => scope === FAVORITES_SCOPE)?.[1].includes(key)
      // The shared store holds the keys that are "not enabled"; for favorites
      // that set is the starred list, so enabling removes and disabling adds.
      await controller.setEnabled(FAVORITES_SCOPE, providerID, modelID, !!starred)
    },
  }
})

const EMPTY: string[] = []

/** Favorited model keys plus a toggle, shared by both model pickers. */
export function useFavoriteModels() {
  const keys = useModelFavorites(s => s.keys)
  const loaded = useModelFavorites(s => s.loaded)
  const load = useModelFavorites(s => s.load)
  const toggle = useModelFavorites(s => s.toggle)
  useEffect(() => { void load() }, [load])
  return {
    favorites: keys.find(([scope]) => scope === FAVORITES_SCOPE)?.[1] ?? EMPTY,
    loaded,
    toggle: (providerID: string, modelID: string) => { void toggle(providerID, modelID) },
  }
}
