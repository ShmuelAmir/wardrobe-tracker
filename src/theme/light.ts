import { primitives } from './primitives';

/**
 * The closed set of semantic color roles (ADR-0013). A role names what a color
 * *does*, not what it looks like, which is the whole reason a dark theme is a
 * remap of this same set rather than a rewrite. Adding a color to the app means
 * justifying a new role here in review — not slipping a literal into a
 * component.
 *
 * `heroGradient` is the one non-single-color role: the `WardrobeHero` gradient
 * is an ordered array of stops, so it resolves to `string[]` per theme.
 */
export type Theme = {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  onAccent: string;
  danger: string;
  onDanger: string;
  heroGradient: string[];
};

/**
 * The light role map — the app's current look, expressed as roles. Migrating a
 * component onto these values is provably a no-op in light mode.
 */
export const light: Theme = {
  background: primitives.grey050,
  surface: primitives.white,
  border: primitives.grey100,
  textPrimary: primitives.ink700,
  textSecondary: primitives.ink500,
  accent: primitives.purple700,
  onAccent: primitives.white,
  danger: primitives.red600,
  onDanger: primitives.white,
  heroGradient: [primitives.purple900, primitives.purple700, primitives.purple500],
};
