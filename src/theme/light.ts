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
 * accent). Collapsing the two would make one of them illegible. (Retired by #66
 * when the hero is redrawn onto the indigo system; kept here because
 * `wardrobe-hero.tsx` still consumes it.)
 *
 * The roles below `onDanger` were added by ticket #57 as it migrated the last
 * screens (following the pilot's `onHero` precedent):
 *  - `fill` — the muted, slightly-tinted background of an inert input field or
 *    an unselected tile. Distinct from `surface` (a card) and `background` (the
 *    screen): it sits *on* a surface as a recessed well.
 *  - `onAccentMuted` — the dimmed foreground on an accent block (a subtitle
 *    under an `onAccent` title). Flips with `onAccent`.
 *  - `warningSurface` / `onWarningSurface` — the non-destructive attention pair:
 *    a warm fill and the warm text that sits on it (the "never worn" badge).
 *  - `warning` — standalone warm attention text on `background` (a web-import
 *    failure), kept a separate role from `onWarningSurface` so its on-background
 *    contrast can be deepened independently.
 *  - `podiumGold` / `podiumSilver` / `podiumBronze` — the §9.4 medal tones.
 *    Decorative metallics, the one place a role resolves to the *same* hex in
 *    both themes. (Retired by #68; kept here because `stats-podium.tsx` still
 *    consumes them.)
 *  - `shadow` / `scrim` — the elevation shadow and the modal-sheet scrim. Both
 *    are occlusions, not surfaces, so both stay constant across themes.
 *
 * The design-parity retrofit (#71, from map #64) adds six roles, each justified
 * by heavy prototype usage per #65:
 *  - `textTertiary` — the third text step (prototype `ink-3`), below
 *    `textSecondary`: metadata and de-emphasised counts.
 *  - `accentSoft` — the tinted accent *well*, an accent-hued background a chip or
 *    hero panel sits on. Distinct from `fill` (a neutral well) and `accent` (the
 *    saturated block).
 *  - `dangerSurface` — the destructive *fill* behind a delete row. The app had
 *    `danger`/`onDanger` but no danger surface.
 *  - `chromeBg` / `chromeInk` / `chromeLine` — the persistent dark nav chrome.
 *    Dark in **both** themes (like the hero block was), so they are foundation,
 *    not a per-theme flip.
 */
export type Theme = {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  onAccent: string;
  onAccentMuted: string;
  accentSoft: string;
  onHero: string;
  fill: string;
  danger: string;
  onDanger: string;
  dangerSurface: string;
  warningSurface: string;
  onWarningSurface: string;
  warning: string;
  podiumGold: string;
  podiumSilver: string;
  podiumBronze: string;
  chromeBg: string;
  chromeInk: string;
  chromeLine: string;
  shadow: string;
  scrim: string;
  // A gradient needs at least two stops; typing it as a non-empty tuple lets it
  // flow straight into `LinearGradient` (which demands ≥2 colors) without a cast.
  heroGradient: readonly [string, string, ...string[]];
};

/**
 * The light role map — the app's look after the design-parity remap (#71),
 * expressed as roles. Every retained role now resolves to an indigo/slate/chrome
 * primitive; `heroGradient` alone still rides the retained purple ramp until #66.
 */
export const light: Theme = {
  background: primitives.slate050,
  surface: primitives.white,
  border: primitives.slate200,
  textPrimary: primitives.slate950,
  textSecondary: primitives.slate600,
  textTertiary: primitives.slate400,
  accent: primitives.indigo600,
  onAccent: primitives.white,
  onAccentMuted: primitives.indigo100,
  accentSoft: primitives.indigo050,
  onHero: primitives.white,
  fill: primitives.slate100,
  danger: primitives.red600,
  onDanger: primitives.white,
  dangerSurface: primitives.red050,
  warningSurface: primitives.amber050,
  onWarningSurface: primitives.amber700,
  warning: primitives.amber700,
  podiumGold: primitives.gold,
  podiumSilver: primitives.silver,
  podiumBronze: primitives.bronze,
  chromeBg: primitives.chromeBlack900,
  chromeInk: primitives.slate025,
  chromeLine: primitives.slate760,
  shadow: primitives.black,
  scrim: primitives.scrimBlack,
  heroGradient: [primitives.purple900, primitives.purple700, primitives.purple500],
};
