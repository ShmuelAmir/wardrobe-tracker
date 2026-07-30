# wardrobe-tracker

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`ShmuelAmir/wardrobe-tracker`), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Design system

Colors are semantic tokens read off `useTheme()`; raw hex lives only in `src/theme/primitives.ts`, guarded by `__tests__/no-raw-hex.test.ts`. See `docs/agents/design-system.md`.
