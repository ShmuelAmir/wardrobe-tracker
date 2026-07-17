# wardrobe-tracker

A personal, on-device iOS app (Expo / React Native) to catalog your wardrobe, build outfits from your items, and see per-item usage stats.

Status: **build-ready** — the spec is locked. See **[SPEC.md](SPEC.md)**, assembled from the [map issue](https://github.com/ShmuelAmir/wardrobe-tracker/issues/1) and its twelve resolved decision tickets.

## Concept

- **Wardrobe** — catalog items (photo, category, name, brand, season). Add via camera, photo library, or web-import from a brand product page.
- **Outfits** — build outfits by tapping items into a grid; log "Wore this today".
- **Stats** — per-item wear counts; most/least/never worn, scoped by a category filter.

Single-user, on-device only (no accounts, no cloud). Storage: expo-sqlite + Drizzle ORM.
