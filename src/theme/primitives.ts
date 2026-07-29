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

  // Warm destructive reds, plus their dark-mode softened pair (higher = darker).
  red200: '#f2b8b5',
  red600: '#b3261e',
  red900: '#4a0e0a',
} as const;
