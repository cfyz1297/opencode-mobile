// Connection types for multiple server support
export type ConnectionType = "local" | "tunnel" | "cloud"

export interface ServerConnection {
  id: string
  name: string
  type: ConnectionType
  url: string
  // For auth
  username?: string
  // Password stored separately in SecureStore
  // Directory to use for this connection
  directory?: string
  // Which opencode server API this URL speaks (probed once, reused across
  // launches; cleared when the URL changes). Absent = not probed yet.
  api?: "v1" | "v2"
  // Version string reported by the server's health/info route, when known.
  serverVersion?: string
  // When last successfully connected
  lastConnected?: number
  // Is this the active connection?
  active?: boolean
}

export interface AppSettings {
  // Require biometric auth to open app
  requireBiometric: boolean
  // Require biometric to send messages
  requireBiometricForMessages: boolean
  // Theme preference
  theme: "light" | "dark" | "system"
  // Show notifications for task completion
  notifications: boolean
}

// Re-export SDK types we'll use frequently
export type { Session, Message, Part, Project, Event, HealthResponse } from "./sdk"
