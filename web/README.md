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

`web/` is its own package with its own lockfile, so its dependency versions and
the root's Expo tree never have to agree. **Both have to be installed**, though —
`npm install` here *and* at the repo root.

## `@` resolves to the repo's real `src/`

Not a copy. The app imports the shipped domain modules, so a module that secretly
needs React Native fails the build here rather than drifting.

That sharing is also why the root install is not optional. A module under `src/`
is still part of the *native* app's TypeScript project: its nearest `tsconfig.json`
is the root one, which extends `expo/tsconfig.base`, and its own imports resolve
against the root's `node_modules`. Vite reads both while transforming it. The
requirement retires at cutover, when `src/` stops being shared.

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

## Signing in

There is **no signup screen**, and that is not a gap: `signUp` lives on the server
permanently so the account can be recreated, gated on both an `OWNER_SIGNUP_SECRET`
deployment variable and a zero-existing-users check (SPEC §13.4). Creating the
account on a fresh deployment — and resetting a forgotten password — is
[`docs/runbook.md`](../docs/runbook.md) procedure 1.

The login form is a **shell state, not a route** (§13.5), so it appears over
whatever URL was asked for and no `?next=` is ever added.

## Colours

There is no colour in any stylesheet. `src/theme/css-vars.ts` generates the
custom-property block from the token modules at runtime and `main.tsx` installs
it before first paint, so a component writes `var(--wt-text-primary)` and the
role resolves per scheme. `__tests__/css-vars.test.ts` guards that every one of
the 23 roles is emitted — a role that is not renders **unstyled, not broken**.
