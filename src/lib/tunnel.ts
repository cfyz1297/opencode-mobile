export type TunnelProvider = 'cloudflare' | 'ngrok'
export type HostPlatform = 'windows' | 'unix'
interface TunnelConnection { name: string; type: 'tunnel'; url: string; username: string }
interface ConnectorDependencies {
  test: (connection: TunnelConnection, password: string) => Promise<{ ok: boolean }>
  add: (connection: TunnelConnection, password: string) => Promise<string>
  activate: (id: string) => Promise<void>
}
export function createTunnelConnector(dependencies: ConnectorDependencies) {
  let pending = false
  return async (input: { url: string; password: string; username: string; provider: TunnelProvider }): Promise<string | null> => {
    if (pending) return null
    const url = tunnelUrl(input.url)
    if (!input.password.trim()) throw new Error('Server password is required')
    pending = true
    try {
      const connection: TunnelConnection = { name: input.provider === 'cloudflare' ? 'Cloudflare tunnel' : 'ngrok tunnel', type: 'tunnel', url, username: input.username.trim() || 'opencode' }
      if (!(await dependencies.test(connection, input.password)).ok) throw new Error('Connection test failed')
      const id = await dependencies.add(connection, input.password)
      await dependencies.activate(id)
      return id
    } finally { pending = false }
  }
}

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
