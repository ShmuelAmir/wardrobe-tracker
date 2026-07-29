import { DarkTheme, DefaultTheme, type Theme as NavTheme } from 'expo-router';

import { dark } from './dark';
import { light, type Theme } from './light';

export type ColorScheme = 'light' | 'dark';

/**
 * The pure theme resolver — the highest seam in the system and the one the unit
 * tests drive (prior art: `wardrobe-view.ts`). Give it a scheme, get back the
 * complete closed role set for that scheme. No React, no rendering.
 */
export function getTheme(scheme: ColorScheme): Theme {
  return scheme === 'dark' ? dark : light;
}

/**
 * The React Navigation adapter. expo-router themes the native headers, tab bar
 * and modal card backgrounds through RN's `Theme`, which is a *different* object
 * from our role map — left unwired, dark mode would flip screen bodies while the
 * chrome stayed light. This maps our roles onto RN's slots so the two flip in
 * lockstep, off the same `colorScheme` read:
 *
 *   accent → primary, background → background, surface → card,
 *   textPrimary → text, border → border.
 *
 * `notification` and `fonts` are left to RN's own base theme — we own colors, not
 * the type ramp the native chrome uses.
 */
export function navigationTheme(scheme: ColorScheme): NavTheme {
  const theme = getTheme(scheme);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: theme.accent,
      background: theme.background,
      card: theme.surface,
      text: theme.textPrimary,
      border: theme.border,
    },
  };
}
