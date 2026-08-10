import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * The web app is built **beside** the native one, not on top of it: everything
 * Vite-shaped lives under `web/`, so metro, babel and the Jest suite at the repo
 * root keep working and the native app stays runnable for the whole port
 * (SPEC §15.1's coexistence window). Two settings carry that arrangement:
 *
 *  - `@` resolves to the repo's **real** `src/`, so the app imports the shipped
 *    domain modules rather than a copy of them. A module that secretly needs
 *    React Native fails the build here instead of drifting out of sync.
 *  - `envDir` points at the repo root, where `npx convex dev` writes `.env.local`.
 *    Vars are **`VITE_`-prefixed** (§2): the Convex CLI wrote `EXPO_PUBLIC_`-
 *    prefixed ones because it detected Expo, and renaming them is part of this
 *    scaffold — `web/README.md` has the two lines a local checkout needs.
 */
export default defineConfig({
  plugins: [react()],
  envDir: repoRoot,
  resolve: { alias: { '@': `${repoRoot}src` } },
  server: { port: 5173 },
});
