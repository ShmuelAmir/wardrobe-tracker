import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * §7.4 in the only form it can be asserted in: the rail↔tabs swap is CSS, so
 * jsdom — which resolves no media queries — cannot observe it by rendering.
 * What it can observe is that the breakpoint is written **once, in the whole
 * app**. A second copy is how the rail and the tabs come to disagree about where
 * 900px is, and how a destination ends up reaching only one of them.
 *
 * The sweep is app-wide rather than shell-wide on purpose: a `@media` landing in
 * any other stylesheet is the same duplication, and a guard that only reads its
 * own neighbour would not see it.
 *
 * Files are read off disk rather than imported — the runner stubs `.css` to an
 * empty module, `?raw` included — and comments are stripped, because the shell
 * stylesheet names the breakpoint in prose and prose is not a declaration.
 */
const WEB_SOURCE = join(process.env.WARDROBE_REPO_ROOT as string, 'web/src');

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const declarations = stylesheets(WEB_SOURCE).flatMap((path) => {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  return (css.match(/@media[^{]*/g) ?? []).map((query) => ({
    file: relative(WEB_SOURCE, path),
    query: query.trim(),
  }));
});

describe('the app has one breakpoint', () => {
  it('declares exactly one media query, at 900px, in the shell stylesheet', () => {
    expect(declarations).toEqual([{ file: 'shell/shell.css', query: '@media (min-width: 900px)' }]);
  });

  it('makes the tabs the base case and the 64px rail the enhancement', () => {
    const shell = readFileSync(join(WEB_SOURCE, 'shell/shell.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const [base, above900] = shell.split('@media (min-width: 900px)');

    expect(base).not.toContain('64px');
    expect(above900).toContain('width: 64px');
  });
});
