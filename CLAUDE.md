# wardrobe-tracker

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`ShmuelAmir/wardrobe-tracker`), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles use their default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Comments

A comment explains the world as it is now, never how it got there — git and the
issue tracker hold the history. Density follows a per-layer budget. See
`docs/agents/comments.md`.

### Design system

Colors are semantic tokens read off `useTheme()`; raw hex lives only in `src/theme/primitives.ts`, guarded by `__tests__/no-raw-hex.test.ts`. See `docs/agents/design-system.md`.
