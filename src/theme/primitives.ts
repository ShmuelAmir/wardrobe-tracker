/**
 * The private primitive palette — raw hex named by hue and shade, the single
 * place a literal color is allowed to live. Components **never** import this
 * file (see ADR-0013): they read semantic roles off `useTheme()`, and a role
 * resolves to a primitive here. Keeping this module private is what lets a role
 * mean different hex in light vs. dark without a component knowing.
 *
 * The values are the palette that was already in the app, lifted verbatim from
 * the inline styles it replaces (the purple spine `#3a2a6d`, the near-white
 * surfaces, the grey ramp, the warm reds) so the light theme is a rename, not a
 * recolor.
 */
export const primitives = {
  // The purple spine and its neighbours — the brand hue.
  purple900: '#1b1033',
  purple800: '#2a1e52',
  purple700: '#3a2a6d',
  purple500: '#6b4fa8',
  purple300: '#a78bda',
  purple100: '#e6e1f5',

  // Near-black inks and the grey text ramp.
  ink900: '#121019',
  ink800: '#1c1830',
  ink700: '#2a2440',
  ink500: '#5a5568',
  ink300: '#9c96b0',

  // Whites and the cool near-white surface/border ramp (higher = darker).
  white: '#ffffff',
  grey050: '#f5f4f8',
  grey075: '#f2f1f6',
  grey100: '#eceaf2',

  // Warm destructive reds, plus their dark-mode pair (higher = darker). `red300`
  // is the coral the `danger` role lands on in dark: `red600` goes muddy on an
  // off-black surface, so dark lifts to a warmer, brighter red that still reads
  // unmistakably as "dangerous".
  red200: '#f2b8b5',
  red300: '#ff8a80',
  red600: '#b3261e',
  red900: '#4a0e0a',

  // Warm attention (warning) hues — distinct from the destructive reds above.
  // These carry the non-destructive "look here" signals, which the design keeps
  // a warm brown-orange so they never read as a delete. The never-worn `0` badge
  // is a peach fill (`peach200`) with burnt-orange text (`burntOrange600`); a
  // standalone web-import failure is a deeper brown (`brown700`) on the plain
  // screen, where more contrast is needed without a fill behind it. `brown900`
  // is the dark fill and `orange300` the lifted amber text/foreground, so the
  // same signals survive on off-black.
  peach200: '#fbe4d6',
  brown900: '#3a2416',
  brown700: '#7a2e1f',
  burntOrange600: '#b5460f',
  orange300: '#f7b267',

  // The three podium medal tones (§9.4). Metallics that read on both light and
  // dark, so — unlike every other role — their two themes resolve to the same
  // hex.
  gold: '#d9a441',
  silver: '#9ca3af',
  bronze: '#b06a3b',

  // Pure black, reserved for elevation shadows (an occlusion, not a surface),
  // which stay black in both themes.
  black: '#000000',

  // The modal scrim — a translucent black wash behind a bottom sheet. Like the
  // shadow, it is an occlusion rather than a surface, so it stays the same in
  // both themes; the one literal here that carries its own alpha.
  scrimBlack: 'rgba(0,0,0,0.35)',
} as const;
