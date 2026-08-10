import { join } from 'node:path';

/**
 * The one thing the byte-identical domain ports need that an ESM runner does not
 * give them: `__dirname`. Three of them (`no-raw-hex`, `domain-db-free`,
 * `web-import-gallery`) resolve a path relative to their own file, which is free
 * in Jest's CJS module scope and undefined under Vitest.
 *
 * A single global value is correct here rather than approximate, because every
 * ported test lives in the same directory — `__tests__/`. A test that moves out
 * of it stops being one of these ports, and the port list in `vitest.config.ts`
 * is where that shows up.
 *
 * The repo root arrives through `test.env` rather than `import.meta.url`, which
 * Vitest's transform does not leave as a `file:` URL.
 */
(globalThis as { __dirname?: string }).__dirname = join(
  process.env.WARDROBE_REPO_ROOT as string,
  '__tests__',
);
