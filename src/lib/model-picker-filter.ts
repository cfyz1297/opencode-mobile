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
  selected: { providerID: string; modelID: string } | null
}): ModelPickerSection[] {
  const list = Array.isArray(opts.providers) ? opts.providers : []
  const q = (opts.query || "").toLowerCase().trim()
  const selected = opts.selected

  const result: ModelPickerSection[] = list
    .map((p) => {
      const models = (p.models || [])
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

  if (selected) {
    result.sort((a, b) => {
      const aHas = a.data.some((m) => m.providerID === selected.providerID && m.modelID === selected.modelID)
      const bHas = b.data.some((m) => m.providerID === selected.providerID && m.modelID === selected.modelID)
      return aHas === bHas ? 0 : aHas ? -1 : 1
    })
  }

  return result
}
