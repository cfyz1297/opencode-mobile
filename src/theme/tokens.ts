// Design tokens — a quiet graphite surface for long reading sessions.
// One cool-neutral hue, three steps of ground, near-white ink, hairline rules
// and a single soft steel-blue used for the primary action and the current
// selection. Monospace belongs to code and commands only.
import { Platform } from "react-native"

const sans = Platform.select({ ios: "System", default: "sans-serif" }) as string

export const T = {
  // ground and raised surfaces
  paper: "#18191d",
  paper2: "#202328",
  paper3: "#2c2f35",
  // ink
  ink: "#e9ebef",
  ink2: "#c4c7ce",
  muted: "#969aa3",
  // rules: the hairline, and the firmer line under a head
  rule: "#34373d",
  rule2: "#484c54",
  // one signal, and one colour for something that failed
  accent: "#9fbedd",
  accentInk: "#101a25",
  accentWash: "#243342",
  danger: "#e19089",
  // modal scrim
  overlay: "rgba(10, 11, 13, 0.72)",
  // type: one reading face, and mono reserved for code and commands
  font: sans,
  mono: Platform.select({ ios: "Menlo", default: "monospace" }) as string,
  // shape: one radius per nesting level
  radius: 12,
  radiusSm: 8,
  radiusFull: 999,
  hair: 1,
} as const

export type Token = keyof typeof T
