# Research: Expo project foundation & SDK choices

Ticket: ShmuelAmir/wardrobe-tracker #2
Date: 2026-07-16
Scope: Foundation/SDK decisions for `wardrobe-tracker` — a personal, on-device iOS app (Expo/React Native + TypeScript, expo-sqlite + Drizzle ORM, images stored as files via expo-file-system).

All claims below are cited to current (2026) primary sources: official Expo docs/changelog, React Navigation docs, and Drizzle ORM docs.

---

## 1. Navigation: expo-router vs react-navigation

**Recommendation: Expo Router.**

Expo's official navigation guide explicitly recommends Expo Router for new Expo projects, and new projects created with `create-expo-app` ship with it by default (the default template as of `--template default@sdk-57`).

Why it fits this app:
- **Zero-config integration with Expo tooling.** Expo Router is "integrated with Expo for Expo CLI and bundling without additional setup," whereas React Navigation requires manual setup. [Expo — Navigation]
- **File-based routing** turns files into routes, plus **typed routes, dynamic routes, lazy bundling in development, static rendering for the web, and automatic deep linking** out of the box. [Expo — Navigation]
- **Built on React Navigation.** Expo Router uses React Navigation under the hood (stack/tab navigators are still available), so you don't lose its capabilities — you get its component navigators plus file-based conventions. Notably, Expo Router v56+ has been "decoupling from React Navigation," but the two remain interoperable. [Expo — Navigation; Expo Blog — Expo Router v56]

When React Navigation alone would make sense: if you need highly custom, code-composed navigators and don't want file-based conventions. For a small single-developer on-device app this customization isn't needed, and Expo Router's typed routes + default template lower friction.

Sources:
- https://docs.expo.dev/develop/app-navigation/
- https://docs.expo.dev/router/introduction/
- https://expo.dev/blog/expo-router-v56-decoupling-from-react-navigation
- https://reactnavigation.org/docs/

---

## 2. Expo Go vs. custom dev build for expo-image-picker, expo-file-system, expo-sqlite

**All three are "Included in Expo Go"** per their SDK reference pages — none *requires* a custom dev build for their core functionality.

| Library | Expo Go? | Config plugin | Custom dev build required? |
|---|---|---|---|
| expo-image-picker | Yes ("Included in Expo Go") | Yes, built-in (CNG) for permission strings / Android crop UI colors | Only if you need those build-time config values baked in |
| expo-file-system | Yes ("Included in Expo Go") | Yes, optional (CNG) for `supportsOpeningDocumentsInPlace`, `enableFileSharing` | No, for core file read/write |
| expo-sqlite | Yes ("Included in Expo Go") | Yes, optional (CNG) for advanced build config | Only for **SQLCipher**, which is "not supported on Expo Go" |

Important nuance: the config-plugin settings "cannot be set at runtime and require building a new app binary to take effect." So while all three *run* in Expo Go, any native configuration (custom permission strings, file-sharing flags, SQLCipher encryption) requires a custom dev build via Continuous Native Generation (CNG).

**Workflow implication for this app:**
- You can prototype in **Expo Go** since none of the three needs a dev build for core use.
- However, Expo now states that **"Expo Go is not recommended as a development environment for production apps"** and recommends migrating to **development builds** (`expo-dev-client`). [Expo SDK 57 changelog]
- Practically: because the app will want proper iOS photo-library permission strings (image picker) and possibly file-sharing flags, plan to move to a **custom development build early**. This is standard for any shipping Expo app and unlocks the config plugins above. If SQLCipher-based DB encryption is ever wanted, a dev build is mandatory.

Sources:
- https://docs.expo.dev/versions/latest/sdk/imagepicker/
- https://docs.expo.dev/versions/latest/sdk/filesystem/
- https://docs.expo.dev/versions/latest/sdk/sqlite/
- https://expo.dev/changelog/sdk-57

---

## 3. Recommended Expo SDK version & minimum iOS target

**Use the latest stable: Expo SDK 57** (released June 30, 2026). It bundles React Native 0.85–0.86 and React 19.2. [Expo changelog; SDK 57 changelog]

Context: SDK 55 (Feb 25, 2026), SDK 56 (May 21, 2026), SDK 57 (Jun 30, 2026). The New Architecture has been default since SDK 53 and is now the stable baseline; RN's focus has shifted from rolling it out toward stability. [SDK 57 changelog]

**Minimum iOS target: iOS 16.4.** The Expo FAQ states: *"Currently, Expo SDK supports Android 7+ and iOS 16.4+."* SDK 57's generated Podfile uses **16.4** as the default deployment target (bumped to 16.4 starting with SDK 56). Adopting the SDK default (16.4) is the sensible minimum — no reason to go lower for a new personal app.

Sources:
- https://expo.dev/changelog (release dates)
- https://expo.dev/changelog/sdk-57 (RN 0.85–0.86, React 19.2)
- https://docs.expo.dev/faq/ ("iOS 16.4+")

---

## 4. Suggested TypeScript project structure with Drizzle + SQLite (and migrations)

Based on Drizzle's official Expo SQLite get-started guide.

### Recommended layout (Expo Router variant)

```
📦 wardrobe-tracker
├ 📂 app/                 # expo-router routes (screens)
│  ├ 📜 _layout.tsx
│  └ 📜 index.tsx
├ 📂 db/
│  ├ 📜 schema.ts         # Drizzle table definitions (sqliteTable)
│  ├ 📜 client.ts         # openDatabaseSync + drizzle() instance
│  └ 📜 queries.ts        # data-access helpers
├ 📂 drizzle/             # GENERATED: SQL migrations + migrations.js
│  ├ 📜 0000_*.sql
│  └ 📜 migrations.js
├ 📂 components/
├ 📜 drizzle.config.ts
├ 📜 metro.config.js
├ 📜 babel.config.js
└ 📜 app.json
```

(Drizzle's own example uses a top-level `App.tsx`; with Expo Router the DB init + `useMigrations` gate lives in `app/_layout.tsx` instead.)

### Migrations approach (drizzle-kit, on-device SQLite)

Expo/React Native cannot run migrations from `.sql` files on the filesystem the way a server can — migrations must be **bundled into the JS bundle as strings** and applied at runtime. The official flow:

1. **`drizzle.config.ts`** — `dialect: 'sqlite'`, `driver: 'expo'`, `schema: './db/schema.ts'`, `out: './drizzle'`.
2. **`metro.config.js`** — push `'sql'` onto `config.resolver.sourceExts` so Metro resolves `.sql` files.
3. **`babel.config.js`** — add `["inline-import", { "extensions": [".sql"] }]` (install `babel-plugin-inline-import`) so the generated SQL is inlined into the bundle as strings.
4. **Generate**: `npx drizzle-kit generate` → writes SQL files + a `migrations.js` into `./drizzle`.
5. **Apply at runtime** with the `useMigrations` hook on app startup, gating the UI until migrations succeed:

```ts
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "./drizzle/migrations";

const expoDb = openDatabaseSync("wardrobe.db");
export const db = drizzle(expoDb);

// in _layout.tsx / App root:
const { success, error } = useMigrations(db, migrations);
// render nothing/splash until `success`, show `error` if it fails
```

Note: install commands in the docs pin the release-candidate channel (`drizzle-orm@rc`, `expo-sqlite@next`, `drizzle-kit@rc`) because Expo SDK support tracks the RC line — check current stable versions when scaffolding.

Sources:
- https://orm.drizzle.team/docs/get-started/expo-new
- https://orm.drizzle.team/docs/connect-expo-sqlite
- https://orm.drizzle.team/docs/kit-web-mobile

---

## 5. Does this app need a state-management library?

**No — SQLite (via Drizzle) + React state is sufficient.** A state-management library (Redux/Zustand/Jotai/etc.) is not warranted for this app.

Reasoning grounded in the architecture:
- **SQLite is the single source of truth.** For an on-device app, the DB already holds persistent app state; a global in-memory store would duplicate it.
- **Drizzle provides a reactive hook, `useLiveQuery`,** for expo-sqlite that re-renders components when underlying data changes — covering the main reason people reach for a global store (keeping views in sync with data). [Drizzle — Expo SQLite]
- **Local UI state** (form inputs, modals, selection) is well handled by React's `useState`/`useReducer` and Context for the few cross-cutting values (e.g., theme).
- Expo Router itself carries navigation state, removing another common need for global state.

Recommendation: start with Drizzle `useLiveQuery` + React local state/Context. Only introduce a lightweight store (e.g., Zustand) later if a concrete need for shared ephemeral, non-persisted cross-screen state emerges — not preemptively.

Sources:
- https://orm.drizzle.team/docs/connect-expo-sqlite (`useLiveQuery`)
- https://docs.expo.dev/router/introduction/

---

## Conflicts / uncertainties

- **Latest SDK moves fast.** Within 2026 Expo shipped SDK 55→56→57; docs "latest" pages track SDK 57 here. Re-verify the newest stable SDK at scaffold time.
- **iOS minimum sourcing.** The Expo FAQ states iOS 16.4+ directly; the exact Podfile default (16.4) came from a WebSearch summary of SDK 56/57 notes rather than a directly-quoted changelog line. The 16.4 figure is consistent across both, but treat the Podfile-default specifics as secondary.
- **Drizzle install channel.** Official docs still show `@rc`/`@next` pins for the Expo integration; confirm whether a stable (non-RC) combination exists for the SDK you scaffold on.
- **`kit-web-mobile` page** was marked "to be updated in a future release" — mobile migration specifics were taken from the `get-started/expo-new` and `connect-expo-sqlite` pages instead.
