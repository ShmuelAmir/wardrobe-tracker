import { primitives } from './primitives';
import type { Theme } from './light';

/**
 * The dark role map — derived from the same primitives using dark-UI conventions
 * (off-black `background`, a lifted `surface`, a *lightened* `accent` so the
 * purple survives on dark, softened text, a still-visible `border`), not a
 * mechanical inversion.
 *
 * `heroGradient` and `danger` are the two roles the pilot (#55) hand-tuned when
 * the Wardrobe tab first rendered dark:
 *  - `heroGradient` deepens to a night-purple (`ink900 → purple900 → purple700`)
 *    rather than the light theme's brighter `purple500` tail, so the first-run
 *    screen reads as a dark brand block and the light `onHero` foreground keeps
 *    strong contrast on every stop.
 *  - `danger` lifts to the warmer, brighter `red300` — the light `red600` turns
 *    muddy on an off-black surface, where a delete affordance must still read as
 *    dangerous.
 * `onHero` stays light (a hair off pure white) because the hero block is dark in
 * both themes.
 */
export const dark: Theme = {
  background: primitives.ink900,
  surface: primitives.ink800,
  border: primitives.ink700,
  textPrimary: primitives.grey075,
  textSecondary: primitives.ink300,
  accent: primitives.purple300,
  onAccent: primitives.purple900,
  onHero: primitives.grey075,
  danger: primitives.red300,
  onDanger: primitives.red900,
  heroGradient: [primitives.ink900, primitives.purple900, primitives.purple700],
};
