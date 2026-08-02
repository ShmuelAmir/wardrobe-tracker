/**
 * The private primitive palette — raw hex named by hue and shade, the single
 * place a literal color is allowed to live. Components **never** import this
 * file (see ADR-0013): they read semantic roles off `useTheme()`, and a role
 * resolves to a primitive here. Keeping this module private is what lets a role
 * mean different hex in light vs. dark without a component knowing.
 *
 * The design-parity retrofit (#71, map #64) re-pitches this palette from the
 * original purple spine onto the prototypes' **indigo** system: a flat cool
 * "slate" ramp for surfaces and text, an indigo accent (`#4c4bd0`), a persistent
 * dark nav chrome, warm reds and a warm amber. The role→primitive table lives in
 * #65; the light values are lifted verbatim from the prototype tokens.
 */
export const primitives = {
  // The cool-neutral "slate" ramp — surfaces and the text ramp. The suffix
  // roughly tracks darkness (low = near-white, high = near-black) but is a label
  // for the prototype value, not a strict monotonic scale, so neighbours can sit
  // a hair out of order. `slate025` is the near-white ink dark-mode text lifts
  // to; `slate975` the off-black ground it sits on. `slate760`/`slate770` back
  // the chrome nav line (kept in this family as cool neutrals).
  slate025: '#f2f3f7',
  slate050: '#f6f7f9',
  slate100: '#eef0f4',
  slate200: '#e3e6ec',
  slate350: '#a3a8b8',
  slate400: '#8d93a3',
  slate500: '#71768a',
  slate600: '#5b6070',
  slate750: '#2a2d38',
  slate760: '#2c2e3d',
  slate770: '#242631',
  slate800: '#23262f',
  slate850: '#191b22',
  slate950: '#15161c',
  slate975: '#0e0f14',

  // The persistent dark nav chrome — dark in **both** themes (like the hero
  // block), so `chromeBg` is the only surface that does not lift for dark.
  chromeBlack900: '#101119',
  chromeBlack950: '#05060a',

  white: '#ffffff',

  // The indigo accent and its neighbours — the new brand hue. `indigo600` is the
  // light `accent`; `indigo300` the tint it lifts to on dark. `indigo050`/`900`
  // back the soft accent well; `indigo100`/`800` the muted on-accent text.
  // `indigo100` is deepened from #65's proposed `#c7c6f2` (which measured
  // ~3.96:1 under the 14px add-item subtitle) to clear WCAG AA on the `accent`
  // block (§1.5).
  indigo050: '#ecebfb',
  indigo100: '#d9d8f7',
  indigo300: '#8f8ef5',
  indigo600: '#4c4bd0',
  indigo800: '#3a3a70',
  indigo900: '#23233c',

  // Warm destructive reds (kept warm). `red600` is the light `danger`; `red350`
  // the coral it lifts to on dark, where `red600` goes muddy on off-black.
  // `red050`/`red975` back the destructive fill; `red900` the dark `onDanger`.
  red050: '#fdeceb',
  red350: '#ff9a8f',
  red600: '#b3261e',
  red900: '#4a0e0a',
  red975: '#3a1a17',

  // Warm attention amber — distinct from the destructive reds so a nudge never
  // reads as a delete. `amber700` is the light warning text; `amber400` the
  // lifted amber for dark; `amber050`/`amber950` the light/dark attention fill.
  amber050: '#fbf1de',
  amber400: '#e0a94d',
  amber700: '#a86a12',
  amber950: '#33280f',

  // Pure black, reserved for elevation shadows (an occlusion, not a surface),
  // which stay black in both themes.
  black: '#000000',

  // The modal scrim — a translucent black wash behind a bottom sheet. Like the
  // shadow, it is an occlusion rather than a surface, so it stays the same in
  // both themes; the one literal here that carries its own alpha.
  scrimBlack: 'rgba(0,0,0,0.35)',
} as const;
