# Design System

How to work with colors and styling in this repo. The full rationale is
[ADR-0013](../adr/0013-design-system-semantic-tokens-system-dark-mode.md); this
is the working checklist.

## The one rule

**A component never names a color.** Raw hex lives in exactly one file —
`src/theme/primitives.ts` — and nothing else imports it. Components read a
*semantic role* off `useTheme()` (`theme.accent`, `theme.textPrimary`, …). A
role resolves to a different primitive per theme, which is what makes dark mode a
remap instead of a rewrite.

## The closed role set

The roles are a closed set (`Theme` in `src/theme/light.ts`). Adding a color to
the app is **not** typing a new hex — it is justifying a **new role** in review,
the way `fill`, `warningSurface`, `accentSoft` and `textTertiary` each earned
their place. If a color you need doesn't map to an existing role, that is a review
conversation, not a literal.

## Reviewing a change that touches styling

- [ ] No hex (`'#…'`) or `rgb()/rgba()` string outside `primitives.ts`.
- [ ] No component imports `src/theme/primitives.ts`.
- [ ] Any new primitive is actually referenced by a role in `light.ts`/`dark.ts`
      (a primitive nothing uses is dead — delete it).
- [ ] A new **role** is justified: it names what the color *does*, no existing
      role fits, and both `light` and `dark` maps set it.
- [ ] Colored files use `makeStyles(theme)` + `useMemo`; pure-layout files use a
      plain top-level `StyleSheet.create` — never both in one file.

## The automated guard

`__tests__/no-raw-hex.test.ts` sweeps `src/` on every `npm test` run and fails if
a quoted color literal appears outside `primitives.ts`. It is the backstop for
the first checklist item, so a stray hex fails CI rather than relying on a
reviewer's eye. Named keywords like `'transparent'` are out of scope — they are
not palette values.
