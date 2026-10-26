// Design tokens — Hallmark "Terminal": one hue, a ramp of lightness, square corners,
// phosphor accent marking the primary action, the current selection and state only.
// Every colour and font in the UI comes from here; no literals past this block.
export const T = {
  // ground and raised surfaces (one hue, three steps)
  paper: "#040805",
  paper2: "#080f0a",
  paper3: "#101a12",
  // ink
  ink: "#e1f1de",
  ink2: "#b2cdaf",
  muted: "#769676",
  // rules: the hairline, and the firmer line under a head or a file header
  rule: "#1d2a1f",
  rule2: "#334934",
  // one signal
  accent: "#7ef473",
  accentInk: "#040b05",
  accentWash: "#062409",
  // modal scrim: the ground itself, so no second hue enters the screen
  overlay: "rgba(4, 8, 5, 0.82)",
  // type: one family, system mono (Martian Mono's role on a device without it)
  mono: "monospace",
  // shape: never a rounded corner, a pill or a soft card
  radius: 0,
  hair: 1,
} as const

export type Token = keyof typeof T
