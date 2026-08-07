import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * PROTOTYPE config, lifted from the #95 slice. `@` still resolves to the real
 * `src/`, and env still comes from the repo root under the `EXPO_PUBLIC_`
 * prefix `npx convex dev` wrote (see #88).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, 'EXPO_PUBLIC_');
  return {
    plugins: [react()],
    resolve: { alias: { '@': `${repoRoot}src` } },
    define: {
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(env.EXPO_PUBLIC_CONVEX_URL),
    },
    server: { port: 5174 },
  };
});
