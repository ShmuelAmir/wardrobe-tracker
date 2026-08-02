import { primitives } from './primitives';

/**
 * The closed set of semantic color roles (ADR-0013). A role names what a color
 * *does*, not what it looks like, which is the whole reason a dark theme is a
 * remap of this same set rather than a rewrite. Adding a color to the app means
 * justifying a new role here in review — not slipping a literal into a
 * component.
 *
 * `heroGradient` is the one non-single-color role: the `WardrobeHero` gradient
 * is an ordered array of stops, so it resolves to `string[]` per theme. #74
 * redrew it onto the indigo system — `[accentSoft, surface]`, the tinted accent
 * well fading into the screen surface — and retired the old `onHero` foreground
 * role with it: the hero is no longer a dark brand block in both themes, so its
 * title/body/CTA now read off `textPrimary`/`textSecondary`/`onAccent` like any
 * other surface content.
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

/**
 * The light role map — the app's look after the design-parity remap (#71),
 * expressed as roles. Every role now resolves to an indigo/slate/chrome
 * primitive — with #74 redrawing `heroGradient` onto the indigo system, the last
 * purple primitive is gone.
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
