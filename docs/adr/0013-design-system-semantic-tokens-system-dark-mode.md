# 13. Design system is roll-your-own semantic tokens; dark mode follows the system

- Status: Accepted
- Date: 2026-07-29
- Owner: [#53 — Design system: semantic tokens + system dark mode](https://github.com/ShmuelAmir/wardrobe-tracker/issues/53)

## Context

Styling lived inline in every component: 42 files each ran their own
`StyleSheet.create` with hardcoded hex. The purple spine (`#3a2a6d`, 42
occurrences), the near-white surfaces, the grey ramp and the warm destructive
reds were a real, coherent palette — but a *duplicated* one, with no named layer
between a component and a color. Two goals forced the issue: we want an actual
design system (named, reusable tokens + a few primitive components), and we want
**dark mode driven by the OS appearance** (no in-app toggle).

Dark mode is the forcing function. In React Native `StyleSheet.create` is
evaluated once at module load, so 42 files that bake colors in at import time
*cannot* react to a live appearance change. Something has to make color
resolution reactive to `useColorScheme()`. The open questions were: build that
ourselves or adopt a styling library; how to name colors so a dark theme is a
remap rather than a rewrite; and how to land the change across 42 files without
an unreviewable big-bang diff.

## Decision

**Roll our own theming; no styling library.** A `ThemeProvider` (React context)
exposes the active theme; components read it through a `useTheme()` hook. Needs
are narrow — one purple theme plus its dark variant, system-driven only, no user
switch, native-only — which is squarely inside what a ~100-line context + hook
covers. Unistyles / Tamagui were rejected: their strengths (many themes,
web+native, high style churn) don't apply, and hand-rolling is the honest way to
learn the pattern. The token layer stays portable to a library later.

**Two token layers: private primitives → semantic roles.** A primitive palette
(`purple900`, `grey100`, …) that components **never** touch, and a semantic layer
that names what a color *does*. Naming by role instead of appearance is the whole
reason a token refactor enables dark mode rather than just relocating hex:
`textPrimary` can resolve to different primitives per theme, whereas a color named
`white` would have to lie in the dark map. The role set is **closed** — new colors
justify a new role in review, not sneak in as a literal:

`background, surface, border, textPrimary, textSecondary, accent, onAccent,
danger, onDanger` — plus **`heroGradient`**, a special case resolving to an
*array* of stops per theme (the `WardrobeHero` gradient doesn't fit a
single-color role). No `success` and no shadow/elevation tokens yet — neither
exists in the current palette.

**Colors are theme-reactive; spacing, radii and typography are flat.** Colors
flow through `useTheme()`. Spacing (a 4/8/12/16/24/32 scale), radii
(`sm/md/pill`) and typography (named text styles: `title`, `body`, `caption`) are
plain static imports — they don't change between light and dark, so they carry no
reactivity cost. Type sizes are fixed for now (no Dynamic Type / font scaling),
matching the "system-driven **color** only" intent.

**House authoring pattern: `makeStyles(theme)` + `useMemo`.** A colored component
defines `makeStyles(theme)` returning `StyleSheet.create({...})` and calls
`const styles = useMemo(() => makeStyles(theme), [theme])`. The file shape barely
changes (stylesheet still at the bottom, components still say `styles.foo`), the
diff is mechanical, and memoization limits recompute to the rare theme flip. Rule:
a file uses `makeStyles` (has any color) **or** a plain top-level
`StyleSheet.create` (pure layout) — never both.

**One `colorScheme` source themes both content and navigation chrome.** expo-router
sits on React Navigation, whose `ThemeProvider` themes the native headers, tab bar
and modal card backgrounds — *not* our context. Left unwired, dark mode would flip
screen bodies while the chrome stayed light. So the root `_layout.tsx` reads
`useColorScheme()` once and drives **both** our `ThemeProvider` and a React
Navigation theme adapter (our semantic tokens mapped onto RN's `Theme.colors`),
in lockstep. `StatusBar` stays `style="auto"`.

**Dark palette is derived, then tuned on-device.** The dark role colors are a
first pass from the existing primitives using dark-UI conventions (off-black
`background`, slightly-lifted `surface`, a *lightened* accent so purple reads on
dark, softened off-white text, darker-but-visible `border`) — not an inversion.
The `dataviz` skill's color methodology and validator check text/background
contrast and light/dark parity; `heroGradient` and the `danger` reds get the most
hand-tuning.

**Migration is incremental, not big-bang.** A 42-file rewrite in one PR is
unreviewable — and each literal→role translation is a real per-usage judgment
(is this white a `surface` or an `onAccent`?). Sequence: **foundation PR** (tokens
+ provider + nav theme, light-only, app looks identical) → **pilot PR**
(`WardrobeHero` + Wardrobe tab, both themes, proves the pattern end-to-end) →
**batch PRs** per tab/area. Unconverted screens keep their literals and simply
don't dark-mode until their batch lands.

**Primitives emerge from the migration, not ahead of it.** Extract a component
only once the migration shows the pattern repeat (~rule of three), so props are
encoded from real call sites. The one exception is **`<Text>`**, which ships in
the foundation PR because the typography tokens are painful to apply without it.
`<Button>`, `<Card>` and `<Screen>` get extracted during batches as the third
occurrence appears.

Code lives in **`src/theme/`** (`primitives.ts`, `light.ts`, `dark.ts`,
`tokens.ts`, `provider.tsx`, `index.ts`) — a cohesive subsystem, hence a folder,
unlike the flat single-purpose modules in `src/`. `<Text>` lives in
`src/components/text.tsx`. Access is `useTheme()`, `theme.<role>`, and
`spacing.md` / `radii.pill` / `type.title`.

## Consequences

- **Every colored component becomes a hook consumer.** Files move from a static
  bottom-of-file stylesheet to `makeStyles(theme)` + `useMemo`; pure-layout files
  are untouched. The change is mechanical but touches ~42 files over several PRs.
- **A dark theme is one object to tune.** Because everything routes through the 9
  roles, getting a dark hex wrong costs nothing structurally — only the
  `dark.ts` map changes.
- **The role set is a review gate.** Introducing a raw hex or a new role is a
  reviewable decision, which keeps the palette from re-fragmenting.
- **Navigation and content flip together** from one `colorScheme` read; there is
  no second source of truth for light/dark.
- **A temporary mixed state is accepted:** mid-migration, some screens dark-mode
  and some don't. Invisible to the single on-device user and harmless.
- **No user-facing theme toggle**, no persisted preference, no Dynamic Type — all
  deliberately out of scope; each is an additive change later (a toggle overrides
  the `colorScheme` source; Dynamic Type makes the type tokens scale-aware).
- **SPEC.md is untouched** — theming is implementation, not product/domain
  behavior. This ADR is the record; no CONTEXT.md glossary entry was added.
