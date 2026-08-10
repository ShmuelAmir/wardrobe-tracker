import { themeStylesheet } from '@/theme/css-vars';
import { light } from '@/theme/light';

/**
 * One of the two tests SPEC §15.5 mandates *by name*, because it fails
 * invisibly: a semantic role that never reaches the emitted custom-property
 * block yields an **unstyled element**, not an error. Nothing crashes, nothing
 * logs, and the miss surfaces as a component that quietly renders in the
 * browser's default colours.
 *
 * It is the successor to `theme.test.ts`'s role-shape half (§15.2): the role set
 * now has a second representation — the CSS block — that can drift from the
 * first.
 *
 * The expected property names are derived here *independently* of the module
 * under test, so a bug in the generator's own kebab-casing cannot make the guard
 * agree with it.
 */

/** `heroGradient` → `--wt-hero-gradient`, derived without touching the generator. */
const expected = Object.keys(light)
  .map((role) => `--wt-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`)
  .sort();

/**
 * Every maximal run of consecutive custom-property lines in the sheet — one run
 * per selector block. Grouping by adjacency rather than by parsing selectors
 * keeps the guard indifferent to how the blocks are nested, which matters
 * because the dark block sits inside a media query.
 */
function declarationRuns(css: string): string[][] {
  const runs: string[][] = [];
  let run: string[] = [];

  for (const line of css.split('\n')) {
    const property = line.trim().match(/^(--[a-z0-9-]+):/)?.[1];
    if (property === undefined) {
      if (run.length > 0) runs.push(run);
      run = [];
    } else {
      run.push(property);
    }
  }
  if (run.length > 0) runs.push(run);

  return runs;
}

describe('the generated custom-property block is total over the role set', () => {
  // The closed set is 23 roles (§2, ADR-0013). Pinned as a number so growing the
  // set is a deliberate edit here, the way adding a role is a review conversation.
  it('has 23 semantic roles to emit', () => {
    expect(expected).toHaveLength(23);
  });

  const [light_, dark_] = declarationRuns(themeStylesheet);

  // Light on `:root`, dark under the media query, and nothing else — a third
  // block would mean an override selector, which ADR-0013 rules out.
  it('emits two declaration blocks — light, then dark', () => {
    expect(declarationRuns(themeStylesheet)).toHaveLength(2);
  });

  // A role missing from *either* block silently resolves to the other scheme's
  // value, which reads as a theming bug rather than a missing declaration.
  it.each([
    ['light', () => light_],
    ['dark', () => dark_],
  ])('emits every role in the %s block', (_scheme, run) => {
    const emitted = new Set(run());
    expect(expected.filter((property) => !emitted.has(property))).toEqual([]);
  });

  // The dark block carries roles and nothing else, so it can be pinned exactly —
  // which catches drift the other way too: a stale property left behind after a
  // role is renamed.
  it('emits nothing but roles in the dark block', () => {
    expect([...dark_].sort()).toEqual(expected);
  });

  it('emits heroGradient as a gradient rather than a bare colour', () => {
    expect(themeStylesheet).toContain('--wt-hero-gradient: linear-gradient(');
  });
});
