import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * The contract guard for the design system (ADR-0013): a raw color literal in
 * app code is a regression — it re-opens the fragmentation the token layer
 * closed. `primitives.ts` is the *one* module allowed to name hex; everything
 * else reads a role — off `useTheme()` on native, off `var(--wt-…)` on the web.
 *
 * This test sweeps the app's source roots for a color literal outside that file
 * and fails if it finds one, so a stray `'#3a2a6d'` can't slip back in through
 * review. It is the automated half of the guard; the human half is the checklist
 * in `docs/agents/design-system.md`.
 *
 * **The scan surface includes `.css`** (ADR-0013's third amendment, SPEC §15.5),
 * and that costs nothing precisely because the custom-property block is
 * generated at runtime from `src/theme/css-vars.ts`: no stylesheet on disk ever
 * holds a value, so the allowlist stays a single entry rather than growing a
 * carve-out for a generated file.
 */

/** Both app source roots: the native app's modules, and the Vite app's. */
const ROOTS = [join(__dirname, '..', 'src'), join(__dirname, '..', 'web', 'src')];
const REPO = join(__dirname, '..');

// The single sanctioned home for raw hex (ADR-0013). Repo-relative.
const ALLOWED = new Set(['src/theme/primitives.ts']);

// In TS a style color is always a *quoted* value — a hex or an `rgb()/rgba()`
// string — so requiring the quote keeps prose like "outfit #200" in a comment
// from reading as an offender.
const TS_COLOR = /['"]#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"]|['"]rgba?\(/;

// In CSS the same value is *unquoted*, so the quote can't be the discriminator
// and the functional notations `hsl()`/`hsla()` join the list. Named keywords
// (`transparent`, `currentColor`) stay out of scope in both: they are keywords,
// not palette values, so they carry no fragmentation risk.
const CSS_COLOR = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgba?|hsla?)\(/;

const PATTERNS: { extension: RegExp; literal: RegExp }[] = [
  { extension: /\.tsx?$/, literal: TS_COLOR },
  { extension: /\.css$/, literal: CSS_COLOR },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return PATTERNS.some(({ extension }) => extension.test(name)) ? [path] : [];
  });
}

function namesAColor(path: string): boolean {
  const { literal } = PATTERNS.find(({ extension }) => extension.test(path)) as (typeof PATTERNS)[0];
  return literal.test(readFileSync(path, 'utf8'));
}

describe('no raw color literals leak outside primitives.ts', () => {
  const offenders = ROOTS.flatMap(sourceFiles)
    .map((path) => relative(REPO, path).split(sep).join('/'))
    .filter((path) => !ALLOWED.has(path))
    .filter((path) => namesAColor(join(REPO, path)));

  it('finds none', () => {
    expect(offenders).toEqual([]);
  });
});
