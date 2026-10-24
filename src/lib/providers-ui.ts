/** Pure helpers for Settings → Providers screen (server-backed; no secrets). */

/** Expo Router path for the Providers settings screen. */
export const PROVIDERS_ROUTE = "/providers" as const

export type ConnectionBadge = "account" | "api_key"

export interface CatalogProviderModel {
  id: string
  name: string
  free?: boolean
}

export interface CatalogProvider {
  id: string
  name: string
  connected: boolean
  models: CatalogProviderModel[]
}

export interface PopularProviderDef {
  id: string
  name: string
  /** i18n key under providers.popular.<id>.description — resolved in UI */
  descriptionKey: string
}

export interface ConnectedProviderRow {
  id: string
  name: string
  modelCount: number
  badge: ConnectionBadge
}

export interface PopularProviderRow {
  id: string
  name: string
  descriptionKey: string
}

export interface ProvidersScreenModel {
  connected: ConnectedProviderRow[]
  popular: PopularProviderRow[]
}

/** Known providers shown under "Popular" when not already connected on the server. */
export const POPULAR_PROVIDERS: readonly PopularProviderDef[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    descriptionKey: "providers.popular.anthropic.description",
  },
  {
    id: "openai",
    name: "OpenAI",
    descriptionKey: "providers.popular.openai.description",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    descriptionKey: "providers.popular.githubCopilot.description",
  },
  {
    id: "beatapi",
    name: "BeatAPI",
    descriptionKey: "providers.popular.beatapi.description",
  },
  {
    id: "google",
    name: "Google",
    descriptionKey: "providers.popular.google.description",
  },
] as const

const ACCOUNT_PROVIDER_IDS = new Set([
  "opencode",
  "opencode-go",
  "opencode-zen",
  "opencode-console",
  "github-copilot",
  "copilot",
])

export function connectionBadgeFor(providerID: string): ConnectionBadge {
  const id = providerID.toLowerCase()
  if (ACCOUNT_PROVIDER_IDS.has(id)) return "account"
  if (id.startsWith("opencode")) return "account"
  return "api_key"
}

export function isFreeModel(cost?: { input?: number; output?: number } | null): boolean {
  if (cost == null) return true
  const input = cost.input ?? 0
  const output = cost.output ?? 0
  return input === 0 && output === 0
}

export function buildProvidersScreenModel(connectedProviders: CatalogProvider[]): ProvidersScreenModel {
  const connected: ConnectedProviderRow[] = (Array.isArray(connectedProviders) ? connectedProviders : []).map(
    (p) => ({
      id: p.id,
      name: p.name || p.id,
      modelCount: Array.isArray(p.models) ? p.models.length : 0,
      badge: connectionBadgeFor(p.id),
    }),
  )

  const connectedIds = new Set(connected.map((p) => p.id.toLowerCase()))
  // Also treat alias "copilot" as covering github-copilot popularity slot.
  if (connectedIds.has("copilot")) connectedIds.add("github-copilot")
  if (connectedIds.has("github-copilot")) connectedIds.add("copilot")

  const popular: PopularProviderRow[] = POPULAR_PROVIDERS.filter(
    (p) => !connectedIds.has(p.id.toLowerCase()),
  ).map((p) => ({
    id: p.id,
    name: p.name,
    descriptionKey: p.descriptionKey,
  }))

  return { connected, popular }
}
