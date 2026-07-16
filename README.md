# wardrobe-tracker

A personal, on-device iOS app (Expo / React Native) to catalog your wardrobe, build outfits from your items, and see per-item usage stats.

Status: **wayfinding** — charting a build-ready spec. See the [map issue](https://github.com/ShmuelAmir/wardrobe-tracker/issues/1).

## Concept

- **Wardrobe** — catalog items (photo, category, brand, color, season). Add via camera, photo library, or web-import from a brand product page.
- **Outfits** — build outfits by tapping items into a grid; log "Wore this today".
- **Stats** — per-item wear counts, most/least/never worn, wears by category.

Single-user, on-device only (no accounts, no cloud). Storage: expo-sqlite + Drizzle ORM.
