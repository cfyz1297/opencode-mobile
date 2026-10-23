export type TunnelProvider = 'cloudflare' | 'ngrok'
export type HostPlatform = 'windows' | 'unix'

export function tunnelUrl(input: string): string {
  const raw = input.trim()
  // Reject ambiguity before URL normalization can erase it.
  if (!/^https:\/\//i.test(raw) || /[\s\\?#]/.test(raw)) throw new Error('Use a public HTTPS URL without credentials, query or fragment')
  const url = new URL(raw)
  if (!url.hostname || url.username || url.password || url.hash || url.search) throw new Error('Invalid tunnel URL')
  return url.toString().replace(/\/+$/, '')
}

export function tunnelCommands(provider: TunnelProvider, input: string, platform: HostPlatform): string[] {
  if (!/^\d{1,5}$/.test(input) || Number(input) < 1 || Number(input) > 65535) throw new Error('Port must be between 1 and 65535')
  const port = String(Number(input))
  const server = platform === 'windows'
    ? `$env:OPENCODE_SERVER_PASSWORD = 'choose-a-long-password'\nopencode serve --hostname 127.0.0.1 --port ${port}`
    : `OPENCODE_SERVER_PASSWORD='choose-a-long-password' opencode serve --hostname 127.0.0.1 --port ${port}`
  return [server, provider === 'cloudflare' ? `cloudflared tunnel --url http://127.0.0.1:${port}` : `ngrok http ${port}`]
}
