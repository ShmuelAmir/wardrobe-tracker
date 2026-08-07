import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * PROTOTYPE config. Two things here are the actual experiment:
 *
 *  - `@` resolves to the **real** `src/` of the native app, so anything the
 *    slice imports is the shipped module, not a copy. If a "platform-free"
 *    domain module secretly needs React Native, the build says so.
 *  - env is loaded from the repo root, where `npx convex dev` writes it. The
 *    vars are still `EXPO_PUBLIC_`-prefixed (see #88), so the slice reads that
 *    prefix rather than pretending the rename already happened.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, 'EXPO_PUBLIC_');
  return {
    plugins: [react()],
    resolve: { alias: { '@': `${repoRoot}src` } },
    define: {
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(env.EXPO_PUBLIC_CONVEX_URL),
    },
    server: { port: 5173 },
  };
});
