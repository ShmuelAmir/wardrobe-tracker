import { dark } from '@/theme/dark';
import { light, type Theme } from '@/theme/light';
import { radii, spacing } from '@/theme/tokens';

/**
 * PROTOTYPE — the token port, and the sharpest question in #95: does ADR-0013's
 * "a component never names a color" survive the move to CSS?
 *
 * The answer this file argues: yes, and *more* cheaply than in React Native,
 * because the role map is already the single source of truth and CSS custom
 * properties are exactly a runtime role→value indirection. Nothing is
 * transcribed. `light` and `dark` are imported from the shipped
 * `src/theme/*.ts` and walked mechanically, so a role added in review shows up
 * as a CSS variable with no second edit — and a role that only exists in one
 * map is a type error, same as today.
 *
 * The consequence worth arguing about in the real build: `useTheme()`
 * disappears. A component stops subscribing to a context and just writes
 * `color: var(--wt-text-primary)`, which means the theme flip costs zero
 * re-renders and `makeStyles(theme)` + `useMemo` — the checklist's last item —
 * becomes unnecessary rather than mandatory.
 */

const kebab = (role: string) => role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The one role that isn't a color: an ordered stop list, top-to-bottom. */
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

/** Spacing and radii don't flip, so they land once on `:root` as plain px. */
function statics(): string {
  return [
    ...Object.entries(spacing).map(([step, px]) => `  --wt-space-${step}: ${px}px;`),
    ...Object.entries(radii).map(([step, px]) => `  --wt-radius-${step}: ${px}px;`),
  ].join('\n');
}

/**
 * Both maps are emitted up front and the *scheme* is selected by an attribute,
 * so switching themes is one attribute write on `<html>` — no JS re-render, and
 * no flash, since the media query already resolved before first paint.
 */
export const themeStylesheet = [
  `:root {\n${statics()}\n${declarations(light)}\n}`,
  `@media (prefers-color-scheme: dark) {\n  :root:not([data-scheme="light"]) {\n${declarations(dark)}\n  }\n}`,
  `:root[data-scheme="dark"] {\n${declarations(dark)}\n}`,
].join('\n\n');

export const ROLE_COUNT = Object.keys(light).length;
