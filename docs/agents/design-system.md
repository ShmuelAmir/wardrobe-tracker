# Design System

How to work with colors and styling in this repo. The full rationale is
[ADR-0013](../adr/0013-design-system-semantic-tokens-system-dark-mode.md); this
is the working checklist.

## The one rule

**A component never names a color.** Raw hex lives in exactly one file —
`src/theme/primitives.ts` — and nothing else imports it. Components read a
*semantic role*, which resolves to a different primitive per theme — the reason
dark mode is a remap instead of a rewrite.

How a component reads a role depends on which app it belongs to, and both apps
are on disk for the length of the port:

- **Web (`web/`)** — `var(--wt-accent)`, `var(--wt-text-primary)`, in real CSS.
  The custom properties are generated **at runtime** by `src/theme/css-vars.ts`
  and installed before first paint. There is no `useTheme()`, no `makeStyles`,
  and the theme flip costs zero re-renders.
- **Native (`src/app/`, `src/components/`)** — `theme.accent` off `useTheme()`.

**Runtime generation is an invariant, not a preference** (SPEC §10 #11). A
build-time `.css` holding the palette would be a second copy of it and would
force the raw-hex guard to grow a carve-out — which is exactly what the token
layer closed.

## The closed role set

The roles are a closed set (`Theme` in `src/theme/light.ts`). Adding a color to
the app is **not** typing a new hex — it is justifying a **new role** in review,
the way `fill`, `warningSurface`, `accentSoft` and `textTertiary` each earned
their place. If a color you need doesn't map to an existing role, that is a review
conversation, not a literal.

## Reviewing a change that touches styling

- [ ] No hex (`'#…'`) or `rgb()/rgba()` string outside `primitives.ts` — in TS
      **or** in a `.css` file, where the same value is unquoted.
- [ ] No component imports `src/theme/primitives.ts`.
- [ ] Any new primitive is actually referenced by a role in `light.ts`/`dark.ts`
      (a primitive nothing uses is dead — delete it).
- [ ] A new **role** is justified: it names what the color *does*, no existing
      role fits, and both `light` and `dark` maps set it. On the web, that is all
      it takes — `css-vars.ts` walks the map, so no second edit emits it.
- [ ] *Native only:* colored files use `makeStyles(theme)` + `useMemo`;
      pure-layout files use a plain top-level `StyleSheet.create` — never both in
      one file.

## The automated guards

Two, and both run on every `npm test` in **both** runners.

`__tests__/no-raw-hex.test.ts` sweeps `src/` and `web/src/` — `.ts`, `.tsx` and
`.css` — and fails if a color literal appears outside `primitives.ts`. It is the
backstop for the first checklist item, so a stray hex fails CI rather than
relying on a reviewer's eye. Named keywords like `transparent` are out of scope:
they are not palette values.

`__tests__/css-vars.test.ts` is the totality guard (SPEC §15.5, mandated by
name): every one of the 23 roles must reach the emitted custom-property block, in
all three of its scheme blocks. It exists because this failure is silent — a role
that is never emitted renders an **unstyled element**, not an error.
