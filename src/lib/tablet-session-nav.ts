/** Concrete href so Expo Router does not treat the switch as a same-route no-op. */
export function tabletSessionHref(session: { id: string; directory?: string | null }) {
  const query = session.directory ? `?directory=${encodeURIComponent(session.directory)}` : ''
  return `/session/${session.id}${query}`
}
