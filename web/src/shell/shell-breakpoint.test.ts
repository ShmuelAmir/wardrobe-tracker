import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * §7.4 in the only form it can be asserted in: the rail↔tabs swap is CSS, so
 * jsdom — which resolves no media queries — cannot observe it by rendering.
 * What it can observe is that the breakpoint is written **once**. A second copy
 * is how the rail and the tabs come to disagree about where 900px is, and how a
 * destination ends up reaching only one of them.
 *
 * The file is read off disk rather than imported: the runner stubs `.css` to an
 * empty module, `?raw` included.
 */
const stylesheet = readFileSync(
  join(process.env.WARDROBE_REPO_ROOT as string, 'web/src/shell/shell.css'),
  'utf8',
  // Comments out: the file's own header names the breakpoint in prose, and
  // prose is not a second declaration of it.
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('the shell has one breakpoint', () => {
  it('declares exactly one media query, at 900px', () => {
    expect(stylesheet.match(/@media[^{]*/g)).toEqual(['@media (min-width: 900px) ']);
  });

  it('makes the tabs the base case and the 64px rail the enhancement', () => {
    const [base, above900] = stylesheet.split('@media (min-width: 900px)');

    expect(base).not.toContain('64px');
    expect(above900).toContain('width: 64px');
  });
});
