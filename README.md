# wardrobe-tracker

A personal, on-device iOS app (Expo / React Native) to catalog your wardrobe, build outfits from your items, and see per-item usage stats.

Status: **build-ready** — the spec is locked. See **[SPEC.md](SPEC.md)**, assembled from the [map issue](https://github.com/ShmuelAmir/wardrobe-tracker/issues/1) and its twelve resolved decision tickets.

## Concept

- **Wardrobe** — catalog items (photo, category, name, brand, season). Add via camera, photo library, or web-import from a brand product page.
- **Outfits** — build outfits by tapping items into a grid; log "Wore this today".
- **Stats** — per-item wear counts; most/least/never worn, scoped by a category filter.

Single-user, on-device only (no accounts, no cloud). Storage: expo-sqlite + Drizzle ORM.

## Running it

The app targets a **custom dev build**, not Expo Go — the iOS camera and photo
library permission strings come from config plugins, which Expo Go can't carry.

```sh
npm install
npm run ios     # prebuild + build + install onto a simulator or connected iPhone
npm start       # start the dev server against an already-installed dev build
```

Building to a physical iPhone needs Xcode, CocoaPods, and a signing team set on
the generated Xcode project (`ios/` is generated and gitignored — rerun
`npm run prebuild` any time the app config changes).

```sh
npm test        # jest + @testing-library/react-native
npm run typecheck
```
