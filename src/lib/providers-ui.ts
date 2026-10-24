/** Pure helpers for Settings > Providers screen (server-backed; no secrets). */

/**
 * Catalog of providers shown under Popular / connect help.
 * IDs match OpenCode `/connect` and models.dev where possible.
 * Descriptions use i18n: special keys when present, else providers.popular.generic.
 */

export interface PopularProviderDef {
  id: string
  name: string
  /** Optional i18n key; default providers.popular.generic.description */
  descriptionKey?: string
  /** Account-style providers (OpenCode Go/Zen, Copilot, …) */
  badge?: "account" | "api_key"
}

/** OpenCode first-party + common `/connect` directory (docs.opencode.ai/providers). */
export const POPULAR_PROVIDERS: readonly PopularProviderDef[] = [
  // OpenCode family — must stay near the top (user subscription)
  {
    id: "opencode",
    name: "OpenCode Zen",
    descriptionKey: "providers.popular.opencode.description",
    badge: "account",
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    descriptionKey: "providers.popular.opencodeGo.description",
    badge: "account",
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen (alias)",
    descriptionKey: "providers.popular.opencode.description",
    badge: "account",
  },
  {
    id: "opencode-console",
    name: "OpenCode Console",
    descriptionKey: "providers.popular.opencodeConsole.description",
    badge: "account",
  },

  // Major clouds / labs
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
    id: "google",
    name: "Google",
    descriptionKey: "providers.popular.google.description",
  },
  {
    id: "google-vertex",
    name: "Google Vertex AI",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    descriptionKey: "providers.popular.githubCopilot.description",
    badge: "account",
  },
  {
    id: "amazon-bedrock",
    name: "Amazon Bedrock",
  },
  {
    id: "azure",
    name: "Azure OpenAI",
  },
  {
    id: "azure-cognitive-services",
    name: "Azure Cognitive Services",
  },

  // Gateways / aggregators
  {
    id: "openrouter",
    name: "OpenRouter",
  },
  {
    id: "vercel",
    name: "Vercel AI Gateway",
  },
  {
    id: "cloudflare-ai-gateway",
    name: "Cloudflare AI Gateway",
  },
  {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
  },
  {
    id: "helicone",
    name: "Helicone",
  },
  {
    id: "llmgateway",
    name: "LLM Gateway",
  },
  {
    id: "eden",
    name: "Eden AI",
  },
  {
    id: "302ai",
    name: "302.AI",
  },

  // Model vendors
  {
    id: "deepseek",
    name: "DeepSeek",
  },
  {
    id: "xai",
    name: "xAI",
  },
  {
    id: "groq",
    name: "Groq",
  },
  {
    id: "cerebras",
    name: "Cerebras",
  },
  {
    id: "mistral",
    name: "Mistral",
  },
  {
    id: "cohere",
    name: "Cohere",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
  },
  {
    id: "together",
    name: "Together AI",
  },
  {
    id: "deepinfra",
    name: "Deep Infra",
  },
  {
    id: "baseten",
    name: "Baseten",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
  },
  {
    id: "nvidia",
    name: "NVIDIA",
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
  },
  {
    id: "minimax",
    name: "MiniMax",
  },
  {
    id: "zai",
    name: "Z.AI",
  },
  {
    id: "venice",
    name: "Venice AI",
  },
  {
    id: "zenmux",
    name: "ZenMux",
  },

  // Local / self-hosted
  {
    id: "ollama",
    name: "Ollama",
  },
  {
    id: "ollama-cloud",
    name: "Ollama Cloud",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
  },
  {
    id: "llama.cpp",
    name: "llama.cpp",
  },

  // Enterprise / niche (still in /connect directory)
  {
    id: "gitlab",
    name: "GitLab Duo",
    badge: "account",
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
  },
  {
    id: "nebius",
    name: "Nebius Token Factory",
  },
  {
    id: "scaleway",
    name: "Scaleway",
  },
  {
    id: "ovhcloud",
    name: "OVHcloud AI Endpoints",
  },
  {
    id: "stackit",
    name: "STACKIT",
  },
  {
    id: "snowflake",
    name: "Snowflake Cortex",
  },
  {
    id: "sap-aicore",
    name: "SAP AI Core",
  },
  {
    id: "cortecs",
    name: "Cortecs",
  },
  {
    id: "gmi",
    name: "GMI Cloud",
  },
  {
    id: "ionet",
    name: "IO.NET",
  },
  {
    id: "modal",
    name: "Modal",
  },
  {
    id: "poolside",
    name: "Poolside",
  },
  {
    id: "scx",
    name: "SCX.ai",
  },
  {
    id: "atomic-chat",
    name: "Atomic Chat",
  },
  {
    id: "frogbot",
    name: "FrogBot",
  },

  // Community / third-party used with OpenCode
  {
    id: "beatapi",
    name: "BeatAPI",
    descriptionKey: "providers.popular.beatapi.description",
  },
] as const

/** Always shown; opens the custom OpenAI-compatible provider flow. */
export const CUSTOM_PROVIDER_ENTRY = {
  id: "other",
  name: "Other (Custom)",
  descriptionKey: "providers.popular.other.description",
} as const


/** Expo Router path for the Providers settings screen. */
export const PROVIDERS_ROUTE = "/providers" as const
export const CUSTOM_PROVIDER_ROUTE = "/providers/custom" as const

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
  badge: ConnectionBadge
  /** Opens custom provider form instead of generic connect help */
  isCustom?: boolean
}

export interface ProvidersScreenModel {
  connected: ConnectedProviderRow[]
  popular: PopularProviderRow[]
  /** Always present — Other / Custom entry */
  custom: PopularProviderRow
}

const ACCOUNT_PROVIDER_IDS = new Set([
  "opencode",
  "opencode-go",
  "opencode-zen",
  "opencode-console",
  "github-copilot",
  "copilot",
  "gitlab",
])

/** Aliases so connecting one OpenCode id hides related popular rows. */
const CONNECTED_ALIASES: Record<string, string[]> = {
  opencode: ["opencode-zen"],
  "opencode-zen": ["opencode"],
  "github-copilot": ["copilot"],
  copilot: ["github-copilot"],
}

export function connectionBadgeFor(providerID: string, hint?: PopularProviderDef["badge"]): ConnectionBadge {
  if (hint === "account" || hint === "api_key") return hint
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

export function descriptionKeyFor(def: PopularProviderDef): string {
  return def.descriptionKey || "providers.popular.generic.description"
}

function expandConnectedIds(ids: Iterable<string>): Set<string> {
  const out = new Set<string>()
  for (const raw of ids) {
    const id = raw.toLowerCase()
    out.add(id)
    for (const alias of CONNECTED_ALIASES[id] || []) out.add(alias)
  }
  return out
}

export function buildProvidersScreenModel(
  connectedProviders: CatalogProvider[],
  query = "",
): ProvidersScreenModel {
  const connected: ConnectedProviderRow[] = (Array.isArray(connectedProviders) ? connectedProviders : []).map(
    (p) => ({
      id: p.id,
      name: p.name || p.id,
      modelCount: Array.isArray(p.models) ? p.models.length : 0,
      badge: connectionBadgeFor(p.id),
    }),
  )

  const connectedIds = expandConnectedIds(connected.map((p) => p.id))
  const q = query.trim().toLowerCase()

  const popular: PopularProviderRow[] = POPULAR_PROVIDERS.filter((p) => !connectedIds.has(p.id.toLowerCase()))
    .filter(
      (p) =>
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q),
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      descriptionKey: descriptionKeyFor(p),
      badge: connectionBadgeFor(p.id, p.badge),
    }))

  const custom: PopularProviderRow = {
    id: CUSTOM_PROVIDER_ENTRY.id,
    name: CUSTOM_PROVIDER_ENTRY.name,
    descriptionKey: CUSTOM_PROVIDER_ENTRY.descriptionKey,
    badge: "api_key",
    isCustom: true,
  }

  return { connected, popular, custom }
}

/** Minimum expected catalog size — guards against accidental shrink regressions. */
export const MIN_POPULAR_PROVIDER_COUNT = 40
