/** Shared filter/sort for session ModelPicker and New Session ModelPickerModal. */

export interface ModelPickerProvider {
  id: string
  name: string
  models: Array<{ id: string; name: string; free?: boolean }>
}

export interface ModelPickerItem {
  providerID: string
  providerName: string
  modelID: string
  modelName: string
  free?: boolean
}

export interface ModelPickerSection {
  title: string
  data: ModelPickerItem[]
}

export function buildModelPickerSections(opts: {
  providers: ModelPickerProvider[]
  query: string
  hidden?: readonly string[]
  selected: { providerID: string; modelID: string } | null
  /** modelKey() values marked as favorite; they also get a section on top. */
  favorites?: readonly string[]
  favoritesTitle?: string
}): ModelPickerSection[] {
  const list = Array.isArray(opts.providers) ? opts.providers : []
  const q = (opts.query || "").toLowerCase().trim()
  const selected = opts.selected
  const hidden = new Set(opts.hidden ?? [])

  const result: ModelPickerSection[] = list
    .map((p) => {
      const models = (p.models || [])
        .filter(m => !hidden.has(JSON.stringify([p.id, m.id])))
        .filter(
          (m) =>
            !q ||
            m.id.toLowerCase().includes(q) ||
            (m.name || "").toLowerCase().includes(q) ||
            (p.name || p.id).toLowerCase().includes(q),
        )
        .map(
          (m): ModelPickerItem => ({
            providerID: p.id,
            providerName: p.name || p.id,
            modelID: m.id,
            modelName: m.name || m.id,
            free: m.free,
          }),
        )

      if (selected) {
        models.sort((a, b) => {
          const aActive = a.providerID === selected.providerID && a.modelID === selected.modelID
          const bActive = b.providerID === selected.providerID && b.modelID === selected.modelID
          return aActive === bActive ? 0 : aActive ? -1 : 1
        })
      }

      return { title: p.name || p.id, data: models }
    })
    .filter((s) => s.data.length > 0)

  const favoriteSet = new Set(opts.favorites ?? [])

  if (selected) {
    result.sort((a, b) => {
      const aHas = a.data.some((m) => m.providerID === selected.providerID && m.modelID === selected.modelID)
      const bHas = b.data.some((m) => m.providerID === selected.providerID && m.modelID === selected.modelID)
      return aHas === bHas ? 0 : aHas ? -1 : 1
    })
  }

  // Built last so the selected-provider sort above cannot push it down: the
  // starred models are the point of the section, they belong at the top.
  if (favoriteSet.size > 0) {
    const starred = result
      .flatMap((section) => section.data)
      .filter((m) => favoriteSet.has(JSON.stringify([m.providerID, m.modelID])))
    // A favorite stays in its provider section too: hiding it from there made
    // the list jump around while starring several models.
    if (starred.length > 0) result.unshift({ title: opts.favoritesTitle ?? "Favorites", data: starred })
  }

  return result
}
