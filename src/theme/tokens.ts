import type { TextStyle } from 'react-native';

/**
 * The flat, static tokens: spacing, radii and typography. Unlike colors, these
 * do **not** change between light and dark, so they are plain imports with no
 * reactivity cost (ADR-0013) — `spacing.md`, `radii.pill`, `type.title`.
 *
 * Type sizes are fixed for now: the ticket's scope is system-driven *color*, so
 * there is no Dynamic Type / font scaling here.
 */

/** The 4-based spacing scale that the inline paddings and gaps already follow. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Corner radii: two card sizes plus the pill used on CTAs and chips. */
export const radii = {
  sm: 8,
  md: 12,
  pill: 999,
} as const;

/**
 * The named text styles the `<Text>` primitive applies. Typography only — color
 * stays a role, applied by the consuming component, so these carry no hex.
 */
export const type = {
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof type;
