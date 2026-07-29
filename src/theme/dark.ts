import { primitives } from './primitives';
import type { Theme } from './light';

/**
 * The dark role map — a first pass derived from the same primitives using
 * dark-UI conventions (off-black `background`, a lifted `surface`, a *lightened*
 * `accent` so the purple survives on dark, softened text, a still-visible
 * `border`), not a mechanical inversion. It is carried as data from this ticket
 * on: nothing consumes it visibly until a screen migrates, so the numbers get
 * their final on-device tuning then. `heroGradient` and the `danger` red are the
 * roles that will want the most hand-tuning.
 */
export const dark: Theme = {
  background: primitives.ink900,
  surface: primitives.ink800,
  border: primitives.ink700,
  textPrimary: primitives.grey075,
  textSecondary: primitives.ink300,
  accent: primitives.purple300,
  onAccent: primitives.purple900,
  danger: primitives.red200,
  onDanger: primitives.red900,
  heroGradient: [primitives.ink900, primitives.purple800, primitives.purple500],
};
