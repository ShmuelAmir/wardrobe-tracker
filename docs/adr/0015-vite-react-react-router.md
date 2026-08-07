# 15. Vite + React + React Router v7, not react-native-web

- Status: Accepted
- Date: 2026-08-07
- Supersedes: [ADR-0002](./0002-expo-react-native-foundation.md)
- Owner: [#95 — Prototype: a Vite + React + Convex vertical slice](https://github.com/ShmuelAmir/wardrobe-tracker/issues/95) and [#99 — Decide routing and navigation for the web app](https://github.com/ShmuelAmir/wardrobe-tracker/issues/99), with layout from [#96](https://github.com/ShmuelAmir/wardrobe-tracker/issues/96); §2 and §7 of `SPEC.md`

## Context

ADR-0002 chose Expo SDK 57 / React Native 0.85 with expo-router, an iOS 16.4 floor,
and distribution via a custom dev build. Nothing in that stack survives a move to
the web, and the move is forced (ADR-0014's Context).

The genuinely open question was not *whether* to leave Expo but **how much to
carry**: `react-native-web` would have let the ~17 existing screens compile for the
browser more or less as written, at the cost of shipping a compatibility layer
forever and styling through an abstraction rather than in CSS.

Routing could not be decided separately. expo-router *is* the framework's routing,
so replacing the framework replaces the router in the same breath.

## Decision

**A fresh React app on Vite, with React Router v7 in library mode. Not
`react-native-web`.**

- **Vite**, SPA build, no SSR.
- **React Router v7, library mode** — no framework mode.
- **One route tree** which both layouts render differently: 17 expo-router files
  become 15 routes.
- **Real CSS**, with the design system's 23 semantic roles emitted as CSS custom
  properties (ADR-0013's third amendment).

**`react-native-web` was rejected on evidence, not preference.** #95 built the
slice against the live deployment. The domain modules port **unmodified** —
`parseWardrobeView` drives the wardrobe screen off `URLSearchParams` without
noticing it is not `useLocalSearchParams` — and the view layer rewrites at roughly
**1:1, ~6,000 lines**. Paying a permanent compatibility layer to avoid a one-time
rewrite of code that has to be redesigned for two-pane desktop anyway is the worse
trade.

**TanStack Router was the real routing alternative and was rejected on a specific
ground.** Its headline feature is validated typed search params — and this repo
already banks that, because `parseWardrobeView` is a **total** parse that degrades
malformed values to defaults. Owning that schema in a domain module is a better
boundary than owning it in the router, so TanStack's main advantage is one already
held. Hand-rolling a router is out at 15 routes with real history semantics.

**The desktop/phone fork is decided once, at the shell.** #96 found that all three
desktop layout theses collapse toward the *same* phone layout below 900px, so this
is one phone design plus one desktop design — which is what makes navigation a
single component behind a single media query rather than two trees.

## Consequences

- **Location is in the URL; state is not.** Detail panes are **nested** routes, so
  the list is rendered by the parent and never unmounts while the URL still names
  the selection — #96's "detail is a pane, not a route" reads as *not a **pushed**
  route*. Reload returns you to what you were looking at. Overlays are a uniform
  `?sheet=` search param, so "Back closes the topmost open thing" is one rule.
- **Browser Back is wizard Back for free**, because each wizard step is a real
  route. This matters more than usual: an installed standalone PWA has **no back
  button** (§14.2), so history has to be driven by in-app affordances that agree
  with it — and every nested surface therefore owns an explicit visible exit.
- **Two Back-trap fixes turned out to be shipped native behaviour that ports
  verbatim**: `review.tsx` already `replace`s into `saved`, and three wizard steps
  already carry `<Redirect>` guards on a missing draft.
- **A debt is carried into cutover.** `wardrobe-view.ts` imports `CATEGORIES` at
  runtime from the Drizzle schema, costing **23.1 kB of `drizzle-orm`** against 237
  bytes for a genuinely platform-free module. `CATEGORIES`/`SEASONS` must move to
  their own module *before* `src/db/` is deleted — see ADR-0016, which owns this.
- **The iOS 16.4 floor, expo-file-system, expo-image-manipulator, expo-router,
  expo-sqlite, and the custom-dev-build distribution plan all retire.** ADR-0002's
  "verify at scaffold time" consequence retires with them.
- **The component tier of the test suite gains reach it never had.** expo-router
  cannot be mounted, so all 19 native screen tests mock it and assert `mockPush`;
  React Router v7 **can** be mounted via `createMemoryRouter`, which is what lets 7
  flow tests replace them and cover things a screen test cannot reach (ADR-0010's
  draft resume, sheet dismissal, browser-Back semantics).
