import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v, type VLiteral, type VUnion } from 'convex/values';

import { CATEGORIES, SEASONS } from '../src/item-taxonomy';

/**
 * SPEC.md §3.2 — four tables, six indexes, and no more of either.
 *
 * Category and season filtering stays in JS: an index per filter combination
 * buys nothing at ~200 items and costs a schema decision per new filter.
 * `outfitItems` carries `userId` for the authz assert but gets **no `by_user`
 * index** — it is only ever reached through a parent-scoped query, so nothing
 * would read it. There is no `by_outfit_and_item` either: membership is written
 * wholesale from a deduped array (§3.3), so the check-then-insert that would
 * have read it does not exist.
 *
 * `userId` is `v.string()` on all four — the auth user id stored directly, with
 * no `users` join. On the join table too, so an authz check is a field compare
 * rather than a parent fetch, and the denormalization cannot drift because a
 * join row's owner never changes.
 *
 * There is **no `createdAt`**: `_creationTime` is the same fact and is already
 * the implicit final column of every index, which is what makes §9.3's
 * oldest-first "never worn" free.
 */

/**
 * A closed vocabulary as a server-side validator, keeping the literal types.
 * Mapping rather than transcribing is what lets `src/item-taxonomy.ts` stay the
 * one place the six categories and four seasons are written down — a value
 * added there is rejected by the server with no second edit.
 */
const literals = <T extends string>(values: readonly T[]): VUnion<T, VLiteral<T>[]> =>
  v.union(...values.map((value) => v.literal(value)));

/**
 * Enforced server-side, not just in TypeScript (§3.1 rule 5): a write carrying
 * an unknown category is rejected by the validator before the mutation body
 * runs. Exported because every write path that names one has to name this.
 */
export const category = literals(CATEGORIES);

/** Absent means unset; all four means year-round. There is no "All-season". */
export const season = literals(SEASONS);

export default defineSchema({
  // Convex Auth's own tables — `users`, `authSessions` and the rest. The Owner
  // document stores nothing custom (§13.4).
  ...authTables,

  items: defineTable({
    userId: v.string(),
    // Opaque identity, plus the serving URL denormalized at insert because it
    // is not derivable from the storage id (§4.3).
    image: v.id('_storage'),
    imageUrl: v.string(),
    category,
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    season: v.optional(v.array(season)),
    sourceUrl: v.optional(v.string()),
  }).index('by_user', ['userId']),

  outfits: defineTable({
    userId: v.string(),
    name: v.optional(v.string()),
    occasion: v.optional(v.string()),
  }).index('by_user', ['userId']),

  outfitItems: defineTable({
    userId: v.string(),
    outfitId: v.id('outfits'),
    itemId: v.id('items'),
  })
    .index('by_outfit', ['outfitId'])
    .index('by_item', ['itemId']),

  wearEvents: defineTable({
    userId: v.string(),
    outfitId: v.id('outfits'),
    // "YYYY-MM-DD", day-granular: timezone-proof, and it sorts lexically, which
    // the card and leaderboard tiebreaks rely on.
    wornOn: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_outfit', ['outfitId']),
});
