/**
 * Pure helpers for the Custom / Other provider flow (desktop `/connect` → Other).
 * The mobile app never persists API keys — it only validates form input and
 * builds Termux/opencode.json guidance the user applies on the server.
 */

export interface CustomProviderInput {
  id: string
  name: string
  baseURL: string
  modelID: string
  modelName?: string
}

export interface CustomProviderValidation {
  ok: boolean
  errors: Partial<Record<keyof CustomProviderInput, string>>
}

export interface CustomProviderPlan {
  providerID: string
  displayName: string
  baseURL: string
  modelID: string
  modelName: string
  /** opencode.json fragment — apiKey uses env placeholder, never a literal secret */
  configJson: string
  /** Step list for Termux / desktop OpenCode */
  termuxSteps: string[]
}

const ID_RE = /^[a-z][a-z0-9_-]{1,63}$/
const MAX_NAME = 80
const MAX_URL = 512
const MAX_MODEL = 128
const RESERVED = new Set([
  "other",
  "opencode",
  "opencode-go",
  "opencode-zen",
  "openai",
  "anthropic",
  "google",
])

export function normalizeProviderId(raw: string): string {
  return (raw || "").trim().toLowerCase().replace(/\s+/g, "-")
}

function hasControlChars(value: string): boolean {
  return /[\x00-\x1f\x7f]/.test(value)
}

export function validateCustomProvider(input: CustomProviderInput): CustomProviderValidation {
  const errors: CustomProviderValidation["errors"] = {}
  const id = normalizeProviderId(input.id)
  if (!id) errors.id = "required"
  else if (!ID_RE.test(id)) errors.id = "invalid"
  else if (RESERVED.has(id)) errors.id = "reserved"

  const name = (input.name || "").trim()
  if (!name) errors.name = "required"
  else if (name.length > MAX_NAME || hasControlChars(name)) errors.name = "invalid"

  const baseURL = (input.baseURL || "").trim()
  if (!baseURL) errors.baseURL = "required"
  else if (baseURL.length > MAX_URL) errors.baseURL = "invalid"
  else {
    try {
      const u = new URL(baseURL)
      if (u.protocol !== "http:" && u.protocol !== "https:") errors.baseURL = "invalid"
    } catch {
      errors.baseURL = "invalid"
    }
  }

  const modelID = (input.modelID || "").trim()
  if (!modelID) errors.modelID = "required"
  else if (/\s/.test(modelID) || modelID.length > MAX_MODEL || hasControlChars(modelID)) errors.modelID = "invalid"

  const modelName = (input.modelName || "").trim()
  if (modelName && (modelName.length > MAX_NAME || hasControlChars(modelName))) errors.modelName = "invalid"

  return { ok: Object.keys(errors).length === 0, errors }
}

/** Scan a config JSON string for literal credential patterns (defence in depth). */
export function configJsonLooksSecretFree(configJson: string): boolean {
  if (/"apiKey"\s*:\s*"(?!\{env:)/.test(configJson)) return false
  if (/sk-[a-zA-Z0-9]{16,}/.test(configJson)) return false
  if (/Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(configJson)) return false
  if (/\bAIzaSy[A-Za-z0-9_-]{20,}/.test(configJson)) return false
  if (/\bgsk_[A-Za-z0-9]{16,}/.test(configJson)) return false
  if (/\bxai-[A-Za-z0-9]{16,}/.test(configJson)) return false
  return true
}

/** Reject plans that look like they contain raw secrets. */
export function assertNoLiteralSecrets(plan: CustomProviderPlan): boolean {
  if (!configJsonLooksSecretFree(plan.configJson)) return false
  const blob = `${plan.displayName}\n${plan.termuxSteps.join("\n")}`
  if (/sk-[a-zA-Z0-9]{16,}/.test(blob)) return false
  if (/\bAIzaSy[A-Za-z0-9_-]{20,}/.test(blob)) return false
  if (/\bgsk_[A-Za-z0-9]{16,}/.test(blob)) return false
  if (/\bxai-[A-Za-z0-9]{16,}/.test(blob)) return false
  return true
}

export function buildCustomProviderPlan(input: CustomProviderInput): CustomProviderPlan | null {
  const validation = validateCustomProvider(input)
  if (!validation.ok) return null

  const providerID = normalizeProviderId(input.id)
  const displayName = input.name.trim()
  const baseURL = input.baseURL.trim().replace(/\/+$/, "")
  const modelID = input.modelID.trim()
  const modelName = (input.modelName || "").trim() || modelID
  const envName = `${providerID.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_API_KEY`

  const config = {
    $schema: "https://opencode.ai/config.json",
    provider: {
      [providerID]: {
        npm: "@ai-sdk/openai-compatible",
        name: displayName,
        options: {
          baseURL,
          apiKey: `{env:${envName}}`,
        },
        models: {
          [modelID]: {
            name: modelName,
          },
        },
      },
    },
  }

  const configJson = JSON.stringify(config, null, 2)
  if (!configJsonLooksSecretFree(configJson)) return null

  const termuxSteps = [
    `In Termux OpenCode TUI run /connect, select Other, enter provider id "${providerID}", then paste your API key (stored only on the server).`,
    `Merge the generated provider block into ~/.config/opencode/opencode.json (or project opencode.json).`,
    `Or export ${envName}=<your-key> in the Termux environment that runs opencode serve.`,
    `Restart opencode serve, then pull to refresh Providers in the mobile app.`,
    `Pick a model under ${displayName} in the session model picker.`,
  ]

  const plan: CustomProviderPlan = {
    providerID,
    displayName,
    baseURL,
    modelID,
    modelName,
    configJson,
    termuxSteps,
  }

  if (!assertNoLiteralSecrets(plan)) return null
  return plan
}
