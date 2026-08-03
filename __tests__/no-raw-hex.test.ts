import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

/**
 * The contract guard for the design system (ADR-0013): a raw color literal in
 * app code is a regression — it re-opens the fragmentation the token layer
 * closed. `primitives.ts` is the *one* module allowed to name hex; everything
 * else reads a role off `useTheme()`.
 *
 * This test sweeps `src/` for a color literal outside that file and fails if it
 * finds one, so a stray `'#3a2a6d'` can't slip back in through review. It is the
 * automated half of the guard; the human half is the checklist in
 * `docs/agents/design-system.md`.
 *
 * It matches only *quoted* color values — a hex or `rgb()/rgba()` string, the
 * shape a React Native style color always takes — so prose like "outfit #200" in
 * a comment is not a false positive. Named CSS colors (`'transparent'`) are out
 * of scope: they are keywords, not palette values, so they carry no
 * fragmentation risk.
 */

const SRC = join(__dirname, '..', 'src');

// The single sanctioned home for raw hex (ADR-0013). Relative to `src/`.
const ALLOWED = new Set(['theme/primitives.ts']);

// A quoted hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) or a quoted `rgb(`/
// `rgba(` — i.e. an actual style color, not a `#123` in prose.
const COLOR_LITERAL = /['"]#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"]|['"]rgba?\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no raw color literals leak outside primitives.ts', () => {
  const offenders = sourceFiles(SRC)
    .filter((path) => !ALLOWED.has(relative(SRC, path).split(sep).join('/')))
    .filter((path) => COLOR_LITERAL.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SRC, path));

  it('finds none', () => {
    expect(offenders).toEqual([]);
  });
});
