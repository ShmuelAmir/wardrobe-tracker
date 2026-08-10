import { dark } from './dark';
import { light, type Theme } from './light';
import { radii, spacing } from './tokens';

/**
 * The web half of ADR-0013: the same closed role set, expressed as CSS custom
 * properties. A component still never names a colour — it writes
 * `color: var(--wt-text-primary)` and the role resolves per scheme, exactly as
 * `useTheme()` resolves it on native.
 *
 * **Generated at runtime, and that is load-bearing** (SPEC §10 invariant 11,
 * §15.5). A build-time `.css` file holding these values would be a second copy
 * of the palette and would re-open the raw-hex guard's exclusion problem — the
 * guard would have to carve out an exception for it, and an exception is exactly
 * what ADR-0013 closed. Because the block is a string built from `light`/`dark`,
 * no stylesheet on disk ever holds a hex, so widening that guard to sweep `.css`
 * costs nothing.
 *
 * Nothing is transcribed: the maps are walked mechanically, so a role added in
 * review becomes a custom property with no second edit, and a role present in
 * only one map is a type error the same as today. `__tests__/css-vars.test.ts`
 * guards the totality, because a missing role renders unstyled rather than
 * throwing.
 */

/** `textPrimary` → `text-primary`. */
const kebab = (role: string) => role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The one role that isn't a colour: an ordered stop list, painted top-to-bottom. */
const gradient = (stops: Theme['heroGradient']) => `linear-gradient(180deg, ${stops.join(', ')})`;

function declarations(theme: Theme): string {
  return Object.entries(theme)
    .map(([role, value]) =>
      role === 'heroGradient'
        ? `  --wt-hero-gradient: ${gradient(value as Theme['heroGradient'])};`
        : `  --wt-${kebab(role)}: ${value as string};`,
    )
    .join('\n');
}

/** Spacing and radii don't flip between schemes, so they land once on `:root`. */
function statics(): string {
  return [
    ...Object.entries(spacing).map(([step, px]) => `  --wt-space-${step}: ${px}px;`),
    ...Object.entries(radii).map(([step, px]) => `  --wt-radius-${step}: ${px}px;`),
  ].join('\n');
}

/**
 * Both maps are emitted up front and the scheme is chosen by a media query, so
 * the flip costs zero re-renders and cannot flash: `prefers-color-scheme` has
 * already resolved before first paint.
 *
 * There is deliberately **no override selector**. Dark mode is driven by the OS
 * appearance and nothing else (ADR-0013) — no in-app toggle, no persisted
 * preference — so a `[data-scheme]` hook would be a mechanism with no claimant,
 * and the guard below would then pin it in place.
 */
export const themeStylesheet = [
  `:root {\n${statics()}\n${declarations(light)}\n}`,
  `@media (prefers-color-scheme: dark) {\n  :root {\n${declarations(dark)}\n  }\n}`,
].join('\n\n');
