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
 *
 * `onHero` is the light foreground that sits on the hero's brand block (its
 * title, body and CTA pill). It is a *distinct* role from `onAccent`: the hero
 * gradient is dark in **both** themes, so its foreground stays light in both,
 * whereas `onAccent` flips (dark text, for legibility on the lightened dark-mode
 * accent). Collapsing the two would make one of them illegible.
 */
export type Theme = {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  onAccent: string;
  onHero: string;
  danger: string;
  onDanger: string;
  // A gradient needs at least two stops; typing it as a non-empty tuple lets it
  // flow straight into `LinearGradient` (which demands ≥2 colors) without a cast.
  heroGradient: readonly [string, string, ...string[]];
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
  onHero: primitives.white,
  danger: primitives.red600,
  onDanger: primitives.white,
  heroGradient: [primitives.purple900, primitives.purple700, primitives.purple500],
};
