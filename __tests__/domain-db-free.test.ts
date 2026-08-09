import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative } from 'path';

/**
 * The guard for `src/item-taxonomy.ts`'s reason to exist: the wardrobe-view
 * parser must not reach `src/db/` — or Drizzle — through a *runtime* import.
 * One such import costs the parser's bundle 23.8 kB against 786 bytes, because
 * `db/schema.ts` pulls in the whole `drizzle-orm/sqlite-core` table builder.
 *
 * It walks the import graph rather than grepping one file, since the coupling
 * can return one module deeper, spelled `'./db/schema'` or `'@/db/schema'`.
 * `import type` is skipped: types are erased before a bundler sees them.
 */

const SRC = join(__dirname, '..', 'src');
const ENTRY = join(SRC, 'wardrobe-view.ts');

/** An `import`/`export … from '…'`, plus the bare `import '…'` side-effect form. */
const IMPORT = /\b(?:import|export)\s+(type\s+)?(?:[^'"]*?\bfrom\s+)?['"]([^'"]+)['"]/g;

/** A specifier's file on disk, or `null` when it names a package rather than our own source. */
function resolve(specifier: string, importer: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? join(dirname(importer), specifier)
      : null;
  if (base === null) return null;
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) throw new Error(`unresolvable import '${specifier}' in ${importer}`);
  return found;
}

/** Every module and package the entry reaches at runtime, transitively. */
function runtimeReach(entry: string): { files: string[]; packages: string[] } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);

    for (const [, typeOnly, specifier] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      if (typeOnly !== undefined) continue;
      const resolved = resolve(specifier, file);
      if (resolved === null) packages.add(specifier);
      else queue.push(resolved);
    }
  }

  return { files: [...files].map((file) => relative(SRC, file)), packages: [...packages] };
}

describe('the wardrobe-view parser bundles without Drizzle', () => {
  const { files, packages } = runtimeReach(ENTRY);

  it('reaches no module under src/db/', () => {
    expect(files.filter((file) => file.startsWith('db/'))).toEqual([]);
  });

  it('reaches no drizzle package', () => {
    expect(packages.filter((name) => name.startsWith('drizzle'))).toEqual([]);
  });
});
