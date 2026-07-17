# 1. On-device-only, no accounts / cloud / sync

- Status: Accepted
- Date: 2026-07-17
- Owner: wayfinding map ([#1](https://github.com/ShmuelAmir/wardrobe-tracker/issues/1)); §1, §12 of `SPEC.md`

## Context

The app is a personal wardrobe catalog for a single user. A cloud-backed product
would need accounts, a sync engine, conflict resolution, and a backend to run
them — a large, permanent surface for a tool used by one person on one phone.

## Decision

Single-user, **on-device only**. No accounts, no cloud, no sync, no multi-device.
All data (SQLite + image files) lives in the app container.

This is a **locked foundation decision**, not a deferral. Its downstream
consequences are ruled *out of scope*, not "later":

- Cloud sync / accounts / multi-device.
- Sharing / exporting outfits.
- **Local DB backup/export** (iCloud/file export) — explicitly ruled out.

## Consequences

- The whole stack simplifies: no backend, no auth, no network dependency for core
  use (only web-import touches the network, and it needs no backend either —
  ADR-0009).
- **A lost or wiped phone means lost data.** This is the *accepted consequence* of
  the foundation, not an open question. Any backup story would reopen this ADR.
- Post-ship schema migration against on-device data with no backup is a real
  constraint (deferred, §11) precisely because there is no safety net.
