import { primitives } from './primitives';

/**
 * The closed set of semantic color roles (ADR-0013). A role names what a color
 * *does*, not what it looks like, which is the whole reason a dark theme is a
 * remap of this same set rather than a rewrite. Adding a color to the app means
 * justifying a new role here in review — not slipping a literal into a
 * component.
 *
 * The roles that are easy to confuse with a neighbour:
 *  - `fill` — the muted, slightly-tinted background of an inert input field or
 *    an unselected tile. Distinct from `surface` (a card) and `background` (the
 *    screen): it sits *on* a surface as a recessed well.
 *  - `accentSoft` — the tinted accent *well*, an accent-hued background a chip
 *    or hero panel sits on. Distinct from `fill` (a neutral well) and `accent`
 *    (the saturated block).
 *  - `textTertiary` — the third text step, below `textSecondary`: metadata and
 *    de-emphasised counts.
 *  - `onAccentMuted` — the dimmed foreground on an accent block (a subtitle
 *    under an `onAccent` title). Flips with `onAccent`.
 *  - `dangerSurface` — the destructive *fill* behind a delete row, as opposed to
 *    the `danger`/`onDanger` foreground pair.
 *  - `warningSurface` / `onWarningSurface` — the non-destructive attention pair:
 *    a warm fill and the warm text that sits on it (the "never worn" badge).
 *  - `warning` — standalone warm attention text on `background`, a separate role
 *    from `onWarningSurface` so its on-background contrast can be deepened
 *    independently. **Currently unclaimed, and below AA**: light `warning`
 *    measures ~4.1:1 on `background`, so a new consumer has to deepen the
 *    primitive first and add the pair to `__tests__/contrast.test.ts`.
 *  - `chromeBg` / `chromeInk` / `chromeLine` — the persistent dark nav chrome.
 *    Dark in **both** themes, so they are foundation, not a per-theme flip.
 *  - `shadow` / `scrim` — the elevation shadow and the modal-sheet scrim. Both
 *    are occlusions, not surfaces, so both stay constant across themes.
 *
 * `heroGradient` is the one non-single-color role: the `WardrobeHero` gradient
 * is an ordered array of stops, so it resolves to `string[]` per theme. It is
 * `[accentSoft, surface]` — a tinted accent well fading into the screen surface,
 * not a brand block — so the hero's title/body/CTA read off
 * `textPrimary`/`textSecondary`/`onAccent` like any other surface content.
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
  fill: string;
  danger: string;
  onDanger: string;
  dangerSurface: string;
  warningSurface: string;
  onWarningSurface: string;
  warning: string;
  chromeBg: string;
  chromeInk: string;
  chromeLine: string;
  shadow: string;
  scrim: string;
  // A gradient needs at least two stops; typing it as a non-empty tuple lets it
  // flow straight into `LinearGradient` (which demands ≥2 colors) without a cast.
  heroGradient: readonly [string, string, ...string[]];
};

/** The light role map. Every role resolves to an indigo/slate/chrome primitive. */
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
  fill: primitives.slate100,
  danger: primitives.red600,
  onDanger: primitives.white,
  dangerSurface: primitives.red050,
  warningSurface: primitives.amber050,
  onWarningSurface: primitives.amber700,
  warning: primitives.amber700,
  chromeBg: primitives.chromeBlack900,
  chromeInk: primitives.slate025,
  chromeLine: primitives.slate760,
  shadow: primitives.black,
  scrim: primitives.scrimBlack,
  heroGradient: [primitives.indigo050, primitives.white],
};
