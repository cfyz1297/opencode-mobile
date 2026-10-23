/** How the tablet session sidebar switches the open chat without stacking screens. */
export function tabletSessionRoute(session: { id: string; directory?: string | null }) {
  return {
    pathname: '/session/[id]' as const,
    params: {
      id: session.id,
      ...(session.directory ? { directory: session.directory } : {}),
    },
  }
}

/** Prefer setParams when already on a session screen — replace with the same pathname is a no-op in Expo Router. */
export function tabletSessionNavMode(currentId: string | undefined, nextId: string): 'setParams' | 'push' {
  return currentId ? 'setParams' : 'push'
}
