import { primitives } from './primitives';
import type { Theme } from './light';

/**
 * The dark role map — derived from the same primitives using dark-UI conventions
 * (off-black `background`, a lifted `surface`, a *lightened* `accent` so the
 * indigo survives on dark, softened text, a still-visible `border`), not a
 * mechanical inversion.
 *
 * `heroGradient` was the role the pilot (#55) hand-tuned as a dark brand block;
 * #74 redrew it onto the indigo system in both themes — `[accentSoft, surface]`,
 * here the deep `indigo900` accent well fading into the `slate850` surface — so
 * the first-run screen is now a soft tinted panel that tracks the theme rather
 * than a fixed dark block, and its content reads off the ordinary
 * `textPrimary`/`textSecondary`/`onAccent` roles (the old `onHero` is retired).
 *
 * The retained roles resolve dark as their function demands, not by inversion:
 *  - `fill` lifts to `slate800` — a recessed well still has to sit a step *above*
 *    the `slate850` surface it lives on, the opposite of light where it sits
 *    below `white`.
 *  - `onAccentMuted` lands on `indigo800`: dark, muted text on the lightened
 *    `indigo300` accent block (mirroring how `onAccent` flips to dark here).
 *    #78 deepened that primitive so the pair clears AA on this side too.
 *  - `danger` lifts to the warmer, brighter `red350` — the light `red600` turns
 *    muddy on off-black, where a delete affordance must still read as dangerous.
 *  - `dangerSurface` becomes the deep warm `red975`.
 *  - `warningSurface` becomes the deep warm fill `amber950`, and both its
 *    on-surface text (`onWarningSurface`) and the standalone `warning` text lift
 *    to the same amber `amber400` — on off-black the two contexts converge, and
 *    both already clear AA there, so the #85 amber deepen was light-only. Note
 *    `warning` has had no consumer since #78 moved the one it had to `danger`;
 *    the role was deliberately kept (see the light map).
 *  - `textTertiary` lands on `slate500`, a step below the `slate350` secondary.
 *  - `accentSoft` deepens to `indigo900`, an accent-tinted well on off-black.
 *  - the `chrome*` nav roles are dark in both themes; only `chromeBg`/`chromeLine`
 *    deepen a touch (`chromeBlack950`/`slate770`), `chromeInk` stays constant.
 *  - `shadow` and `scrim` stay constant; both are occlusions, not surfaces.
 */
export const dark: Theme = {
  background: primitives.slate975,
  surface: primitives.slate850,
  border: primitives.slate750,
  textPrimary: primitives.slate025,
  textSecondary: primitives.slate350,
  textTertiary: primitives.slate500,
  accent: primitives.indigo300,
  onAccent: primitives.slate975,
  onAccentMuted: primitives.indigo800,
  accentSoft: primitives.indigo900,
  fill: primitives.slate800,
  danger: primitives.red350,
  onDanger: primitives.red900,
  dangerSurface: primitives.red975,
  warningSurface: primitives.amber950,
  onWarningSurface: primitives.amber400,
  warning: primitives.amber400,
  chromeBg: primitives.chromeBlack950,
  chromeInk: primitives.slate025,
  chromeLine: primitives.slate770,
  shadow: primitives.black,
  scrim: primitives.scrimBlack,
  heroGradient: [primitives.indigo900, primitives.slate850],
};
