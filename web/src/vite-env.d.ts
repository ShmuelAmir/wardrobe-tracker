/// <reference types="vite/client" />

/**
 * The client-visible env vars, and the whole of them. They are **`VITE_`-
 * prefixed** (SPEC §2) — Vite exposes no other prefix to the bundle, which is
 * the point: `CONVEX_DEPLOYMENT` is the CLI's and stays server-side by
 * construction rather than by discipline.
 *
 * The values live in `.env.local` at the repo root, which is gitignored, so this
 * declaration is the only place their names are checked. `npx convex dev` writes
 * them `EXPO_PUBLIC_`-prefixed because it detects Expo at the root; `web/README.md`
 * has the two lines a local checkout needs.
 */
interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CONVEX_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
