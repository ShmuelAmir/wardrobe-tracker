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
onHero, danger, onDanger` — plus **`heroGradient`**, a special case resolving to
an *array* of stops per theme (the `WardrobeHero` gradient doesn't fit a
single-color role). `onHero` was added by the pilot (#55) through this same
review gate: the hero block is dark in *both* themes, so its foreground stays
light in both, whereas `onAccent` flips (dark text, for legibility on the
lightened dark-mode accent) — collapsing the two would make one illegible.

The final batch (#57), migrating the remaining screens (Outfits, Stats,
add-item, outfit-builder, item detail/edit), surfaced ten more roles through
the gate — each a color the older screens carried as a literal that no existing
role covered:

- **`fill`** — the recessed, faintly-tinted background of an inert input or an
  unselected tile. Neither `surface` (a raised card) nor `background` (the
  screen) fit: it sits *on* a surface as a well, so in dark it lifts *above* the
  surface (`ink700`) where in light it sits *below* it (`grey075`).
- **`onAccentMuted`** — the dimmed foreground on an accent block (a subtitle
  under an `onAccent` title). Flips with `onAccent`, so it can't be `onAccent`
  at reduced opacity.
- **`warningSurface` / `onWarningSurface` / `warning`** — the non-destructive
  attention set, deliberately distinct from `danger`/`onDanger` so a nudge never
  reads as a delete. `warningSurface` + `onWarningSurface` are the "never worn"
  `0` badge (peach fill, burnt-orange text); `warning` is a *standalone* warm
  text (a web-import failure) on the plain screen, a deeper brown because it has
  no fill behind it. They stayed three roles rather than two so light-mode hex is
  preserved exactly (the older screens used two different browns); in dark the
  two text roles converge on one amber.
- **`shadow` / `scrim`** — the original ADR noted "no shadow/elevation tokens
  yet"; two occlusion colors are now the first. `shadow` is the segmented
  control's selected-segment shadow; `scrim` is the translucent wash behind a
  bottom sheet (the one role carrying its own alpha). Both stay constant across
  themes because an occlusion is not a surface. Still no broader elevation scale.

Still no `success` token — nothing in the palette needs one.

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
- **A dark theme is one object to tune.** Because everything routes through the
  role set (20 single-color roles + `heroGradient` after #57), getting a dark hex
  wrong costs nothing structurally — only the `dark.ts` map changes.
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

## Amendment (2026-07-31) — design-parity retrofit

The [design-parity retrofit](https://github.com/ShmuelAmir/wardrobe-tracker/issues/71) (map
[#64](https://github.com/ShmuelAmir/wardrobe-tracker/issues/64)) re-pitches the
palette from the original purple spine onto the prototypes' **indigo** system
(`accent #4c4bd0`, a flat `ground/surface/ink` slate ramp, a persistent dark nav
chrome). The two-layer architecture, the closed-role-set gate, the `makeStyles`
pattern and system-driven dark mode are all **unchanged** — this is a remap plus a
role-set evolution, exactly the kind of change the token layer was built to absorb.
The full role→primitive table and the build-ready deltas live in the
[design-parity spec](https://github.com/ShmuelAmir/wardrobe-tracker/issues/71); the role-set changes of record are:

- **Six roles added**, each through the same review gate: `textTertiary` (the
  third text step, `ink-3`), `accentSoft` (the tinted accent well), `dangerSurface`
  (the destructive fill), and `chromeBg` / `chromeInk` / `chromeLine` (the
  persistent dark nav — dark in *both* themes, like the retired `onHero` block was).
- **`onHero` retired.** The hero is redrawn to an `accentSoft → surface` gradient
  with content over `textPrimary`/`textSecondary`/`onAccent`, so the "dark in both
  themes" foreground role that justified `onHero` no longer has a surface to sit on.
- **`podiumGold` / `podiumSilver` / `podiumBronze` retired.** The Variant B stats
  podium drops the medal tint (rank now reads from height + position), removing the
  roles' only consumer. Per the no-dead-primitive rule they left the role set, and
  the `gold`/`silver`/`bronze` primitives were deleted with them — with that, the
  role set no longer has a member resolving to the same hex in both themes for
  decorative reasons; the only cross-theme constants left are the `chrome*` nav
  and the two occlusions, each constant because of what it *is*.
- **The purple primitive ramp is deleted** (`purple900…purple100`). Every role it
  backed (`onHero`, `heroGradient`, `onAccentMuted`) now resolves to indigo/slate,
  so the whole ramp is dead and removed. `heroGradient` is redrawn to
  `[accentSoft, surface]`.
- **Two carried contrast flags** for the build's on-device tuning pass:
  `onAccentMuted` (no prototype source, ~3.96:1 at its one consumer) and any
  standalone `warning` text on a plain surface.

The invariant the guard enforces is unchanged and was the sizing constraint on this
amendment: every hex in `primitives.ts`, every primitive referenced by ≥1 role.
Implementation is a separate effort; this amendment records the accepted design.
