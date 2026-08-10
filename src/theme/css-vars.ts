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
 * no `.css` file ever holds a hex, so widening the guard to `src/**‍/*.css`
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
 * Both maps are emitted up front and the *scheme* is chosen by a selector, so a
 * theme flip is one attribute write on `<html>` — no re-render, and no flash,
 * since the media query has already resolved before first paint. `data-scheme`
 * is the explicit override; absent it, the system preference wins.
 */
export const themeStylesheet = [
  `:root {\n${statics()}\n${declarations(light)}\n}`,
  `@media (prefers-color-scheme: dark) {\n  :root:not([data-scheme="light"]) {\n${declarations(dark)}\n  }\n}`,
  `:root[data-scheme="dark"] {\n${declarations(dark)}\n}`,
].join('\n\n');
