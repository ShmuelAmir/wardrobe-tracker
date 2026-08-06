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
npm run ios     # prebuild + build + install onto a simulator
npm run phone   # same, onto the iPhone in $IPHONE_UDID (prompts if unset)
npm start       # start the dev server against an already-installed dev build
```

`IPHONE_UDID` is a per-machine setting, not a project one — export it from your
shell profile (`xcrun xctrace list devices` lists the UDIDs). It is kept out of
the repo because it identifies a personal device, not because it is a secret.

Building to a physical iPhone needs Xcode and CocoaPods, but not the Xcode UI:
the signing team lives in `app.json` (`ios.appleTeamId`), so `npm run prebuild`
regenerates the gitignored `ios/` directory with signing already configured.

The build is signed with a free Apple ID, whose provisioning profile expires
after 7 days — when the phone says *"Wardrobe Tracker" is No Longer Available*,
rerun `npm run phone`. Installing over the existing app preserves the SQLite
database; deleting the app does not.

```sh
npm test        # jest + @testing-library/react-native
npm run typecheck
```
