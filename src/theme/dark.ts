import { primitives } from './primitives';
import type { Theme } from './light';

/**
 * The dark role map — derived from the same primitives using dark-UI conventions
 * (off-black `background`, a lifted `surface`, a *lightened* `accent` so the
 * indigo survives on dark, softened text, a still-visible `border`), not a
 * mechanical inversion.
 *
 * `heroGradient` is the role the pilot (#55) hand-tuned when the Wardrobe tab
 * first rendered dark, and the retrofit keeps it on the retained purple ramp
 * until #66: it deepens to a night-purple (`slate975 → purple900 → purple700`)
 * rather than the light theme's brighter `purple500` tail, so the first-run
 * screen reads as a dark brand block and the light `onHero` foreground keeps
 * strong contrast on every stop. `onHero` stays light (`slate025`, a hair off
 * pure white) because the hero block is dark in both themes.
 *
 * The retained roles resolve dark as their function demands, not by inversion:
 *  - `fill` lifts to `slate800` — a recessed well still has to sit a step *above*
 *    the `slate850` surface it lives on, the opposite of light where it sits
 *    below `white`.
 *  - `onAccentMuted` lands on `indigo800`: dark, muted text on the lightened
 *    `indigo300` accent block (mirroring how `onAccent` flips to dark here).
 *  - `danger` lifts to the warmer, brighter `red350` — the light `red600` turns
 *    muddy on off-black, where a delete affordance must still read as dangerous.
 *  - `dangerSurface` becomes the deep warm `red975`.
 *  - `warningSurface` becomes the deep warm fill `amber950`, and both its
 *    on-surface text (`onWarningSurface`) and the standalone `warning` text lift
 *    to the same amber `amber400` — on off-black the two contexts converge.
 *  - `textTertiary` lands on `slate500`, a step below the `slate350` secondary.
 *  - `accentSoft` deepens to `indigo900`, an accent-tinted well on off-black.
 *  - the podium metals are unchanged — they read on both themes.
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
  onHero: primitives.slate025,
  fill: primitives.slate800,
  danger: primitives.red350,
  onDanger: primitives.red900,
  dangerSurface: primitives.red975,
  warningSurface: primitives.amber950,
  onWarningSurface: primitives.amber400,
  warning: primitives.amber400,
  podiumGold: primitives.gold,
  podiumSilver: primitives.silver,
  podiumBronze: primitives.bronze,
  chromeBg: primitives.chromeBlack950,
  chromeInk: primitives.slate025,
  chromeLine: primitives.slate770,
  shadow: primitives.black,
  scrim: primitives.scrimBlack,
  heroGradient: [primitives.slate975, primitives.purple900, primitives.purple700],
};
