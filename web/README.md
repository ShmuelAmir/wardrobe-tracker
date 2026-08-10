# web/

The Vite + React app (ADR-0015, SPEC §2). It is built **beside** the native app,
not on top of it: nothing at the repo root is rewired, so metro, babel and the
Jest suite keep working and the native app stays runnable for the whole port.

| | |
|---|---|
| `npm run dev` | dev server on `:5173` |
| `npm run build` | SPA build, no SSR |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, both projects |

Install with `npm install` **in this directory** — `web/` is its own package, so
the root's Expo dependency tree and this one never have to agree.

## `@` resolves to the repo's real `src/`

Not a copy. The app imports the shipped domain modules, so a module that
secretly needs React Native fails the build here rather than drifting.

## Env vars are `VITE_`-prefixed

Vite reads `.env.local` from the **repo root**, where `npx convex dev` writes it.
The CLI wrote `EXPO_PUBLIC_`-prefixed vars because it detected Expo; a local
checkout needs them under the `VITE_` prefix instead (the file is gitignored, so
this is a one-time local edit):

```
VITE_CONVEX_URL=…
VITE_CONVEX_SITE_URL=…
```

`CONVEX_DEPLOYMENT` is read by the CLI, not the client, and keeps its name.

## Colours

There is no colour in any stylesheet. `src/theme/css-vars.ts` generates the
custom-property block from the token modules at runtime and `main.tsx` installs
it before first paint, so a component writes `var(--wt-text-primary)` and the
role resolves per scheme. `__tests__/css-vars.test.ts` guards that every one of
the 23 roles is emitted — a role that is not renders **unstyled, not broken**.
