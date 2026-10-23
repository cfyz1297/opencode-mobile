export function adaptiveLayout(width: number) {
  const tablet = width >= 768
  const split = width >= 1000
  const sidebar = split ? 280 : 0
  return { tablet, split, sidebar, content: Math.min(1100, Math.max(0, width - sidebar)) }
}
