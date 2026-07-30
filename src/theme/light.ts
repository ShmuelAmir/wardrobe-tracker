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
 *
 * The roles below `onDanger` were added by ticket #57 as it migrated the last
 * screens (following the pilot's `onHero` precedent — a new role is justified in
 * review, never a literal slipped into a component):
 *  - `fill` — the muted, slightly-tinted background of an inert input field or
 *    an unselected tile. Distinct from `surface` (a card) and `background` (the
 *    screen): it sits *on* a surface as a recessed well.
 *  - `onAccentMuted` — the dimmed foreground on an accent block (a subtitle
 *    under an `onAccent` title). Flips with `onAccent`.
 *  - `warningSurface` / `onWarningSurface` — the non-destructive attention pair:
 *    a warm fill and the warm text that sits on it (the "never worn" badge).
 *  - `warning` — standalone warm attention text on `background` (a web-import
 *    failure), a deeper brown than `onWarningSurface` because it has no fill
 *    behind it. All three are kept apart from `danger` so a nudge never reads as
 *    a delete.
 *  - `podiumGold` / `podiumSilver` / `podiumBronze` — the §9.4 medal tones.
 *    Decorative metallics, the one place a role resolves to the *same* hex in
 *    both themes.
 *  - `shadow` / `scrim` — the elevation shadow and the modal-sheet scrim. Both
 *    are occlusions, not surfaces, so both stay constant across themes.
 */
export type Theme = {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  onAccent: string;
  onAccentMuted: string;
  onHero: string;
  fill: string;
  danger: string;
  onDanger: string;
  warningSurface: string;
  onWarningSurface: string;
  warning: string;
  podiumGold: string;
  podiumSilver: string;
  podiumBronze: string;
  shadow: string;
  scrim: string;
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
  onAccentMuted: primitives.purple100,
  onHero: primitives.white,
  fill: primitives.grey075,
  danger: primitives.red600,
  onDanger: primitives.white,
  warningSurface: primitives.peach200,
  onWarningSurface: primitives.burntOrange600,
  warning: primitives.brown700,
  podiumGold: primitives.gold,
  podiumSilver: primitives.silver,
  podiumBronze: primitives.bronze,
  shadow: primitives.black,
  scrim: primitives.scrimBlack,
  heroGradient: [primitives.purple900, primitives.purple700, primitives.purple500],
};
