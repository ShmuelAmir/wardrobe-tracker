# 2. Expo / React Native foundation & SDK choices

- Status: Accepted
- Date: 2026-07-17
- Owner: [#2 — Research: Expo project foundation & SDK choices](https://github.com/ShmuelAmir/wardrobe-tracker/issues/2) (findings on branch `research/expo-foundation`); §2 of `SPEC.md`

## Context

An on-device iOS app needs a stack that gives camera / photo-library access, local
persistence, on-disk image storage, and file-based navigation, without standing up
a backend.

## Decision

- **Framework:** Expo / React Native, TypeScript.
- **SDK:** Expo SDK 57 (RN 0.85–0.86, React 19.2); minimum **iOS 16.4**.
- **Navigation:** Expo Router — file-based routing, typed routes, automatic deep
  linking (built on React Navigation).
- **Images on disk:** expo-file-system.
- **Distribution:** plan to move to a **custom dev build** (`expo-dev-client`)
  early. Expo Go runs expo-image-picker / expo-file-system / expo-sqlite so early
  work is unblocked, but config-plugin settings — iOS permission strings in
  particular — require a dev build, and this app needs proper permission strings.

Database and state choices are their own decision (ADR-0003).

## Consequences

- Project structure: `db/schema.ts` + `db/client.ts` + a generated `drizzle/`
  folder.
- **Verify at scaffold time.** SDK versions churned three times within 2026
  (55 → 56 → 57); the iOS 16.4 minimum and Podfile specifics came from
  documentation/search summaries, not first-hand. Re-verify the latest SDK and a
  stable Drizzle-Expo install channel when scaffolding.
- Committing to a dev build early avoids building the flow against Expo Go's
  constraints and then having to rework permissions.
