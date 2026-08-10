import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The same root and the same `@`, from the same place the build reads them.
import { alias, repoRoot } from './vite.config';

const shim = (name: string) => fileURLToPath(new URL(`./test/shims/${name}.ts`, import.meta.url));

/**
 * The domain tests at the repo root that this runner shares with Jest — the same
 * files, no fork and no edit, so ten of them are **byte-identical** ports
 * (§15.2) and `css-vars` is new to both. `globals: true` below is what buys
 * that: the ports keep Jest's bare `describe`/`it`/`expect` and so need no
 * re-review.
 *
 * Four of §15.2's fourteen are deliberately absent and stay Jest-only until the
 * tier they belong to is rewritten:
 *  - `theme.test.ts` — §15.2 says outright it does not port clean; it imports
 *    `navigationTheme`, which dies with expo-router. Its role-shape half is
 *    succeeded by `css-vars.test.ts`, which ships here.
 *  - `web-download`, `web-import`, `web-import-failure` — all three drive
 *    `jest.mock`/`jest.spyOn` against expo modules, and their subjects are
 *    rewritten rather than ported (§5.3 moves the fetch half into a Convex
 *    action, §15.4 splits the rest across the project boundary). Porting them
 *    now would mean editing them twice.
 */
const ROOT_DOMAIN_TESTS = [
  'contrast',
  'css-vars',
  'delete-copy',
  'domain-db-free',
  'item-detail-helpers',
  'no-raw-hex',
  'outfit-selection',
  'relative-time',
  'stats-copy',
  'wardrobe-view',
  'web-import-gallery',
].map((name) => `${repoRoot}__tests__/${name}.test.ts`);

/**
 * One config, two projects, one `npm test` (§15.1). The split is forced rather
 * than chosen: `convex-test` needs a Web-API runtime (`edge-runtime`) and
 * component tests need a DOM (`jsdom`), and no single environment is both.
 *
 * The `convex` project matches nothing yet — the Convex functions land with the
 * data model — so it passes empty on purpose, standing ready rather than
 * arriving later.
 */
export default defineConfig({
  test: {
    // The `convex` project below matches nothing yet, and an empty project is
    // not a failure — see its comment.
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'convex',
          globals: true,
          environment: 'edge-runtime',
          include: [`${repoRoot}convex/**/*.test.ts`],
        },
      },
      {
        plugins: [react()],
        // The ported tests and the modules they exercise live above `web/`, so
        // the loader has to be allowed out of the project root to reach them.
        server: { fs: { allow: [repoRoot] } },
        resolve: {
          alias: {
            ...alias,
            // The native packages the ported tests still reach through the
            // shipped modules. They exist only for the coexistence window and
            // are deleted with `src/db/` and the expo dependencies at cutover —
            // nothing under `web/src/` may import any of them.
            'react-native': shim('react-native'),
            'expo-router': shim('expo-router'),
            'expo-network': shim('expo-network'),
          },
        },
        test: {
          name: 'web',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./test/setup.ts'],
          env: { WARDROBE_REPO_ROOT: repoRoot },
          include: ['src/**/*.test.{ts,tsx}', ...ROOT_DOMAIN_TESTS],
        },
      },
    ],
  },
});
