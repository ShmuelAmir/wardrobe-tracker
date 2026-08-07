import { useQuery } from 'convex/react';

import { api } from '../../../convex/_generated/api';

/**
 * PROTOTYPE data for #96.
 *
 * **Items are real** — the same `api.items.list` read the #95 slice used,
 * against the seeded `dev:mellow-oyster-459` deployment, so grid density and
 * image weights on screen are the real thing.
 *
 * **Outfits and wear events are synthesized in the browser.** The deployment
 * has no outfit seed and #97 hasn't decided their shape yet, so inventing rows
 * server-side would be pre-empting that ticket. They are derived
 * deterministically from the real items, purely so the builder / stats /
 * wear-again surfaces have something honest-looking to lay out. Nothing here
 * writes, per the prototype rules.
 */

export type Item = {
  _id: string;
  _creationTime: number;
  category: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
};

export type Outfit = {
  id: string;
  name: string;
  occasion: string | null;
  itemIds: string[];
  wearDates: string[];
};

export type WardrobeData = {
  loading: boolean;
  items: Item[];
  outfits: Outfit[];
  /** item id → wear count, the read-time join #91 confirmed ADR-0004 keeps. */
  wearCounts: Map<string, number>;
  /** item id → most recent wear date, or null. */
  lastWorn: Map<string, string | null>;
};

const OUTFIT_NAMES = [
  'Weekday default',
  'Shul',
  'Coffee run',
  'Dinner out',
  'Cold morning',
  'Gym and back',
  'Interview',
];
const OCCASIONS = ['work', 'shul', 'casual', 'evening', null, 'gym', 'work'];

/** Stable pseudo-random so the same seed data reads the same on every reload. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function daysAgo(n: number): string {
  const date = new Date(Date.now() - n * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function synthesize(items: Item[]): { outfits: Outfit[]; wearCounts: Map<string, number>; lastWorn: Map<string, string | null> } {
  const outfits: Outfit[] = OUTFIT_NAMES.map((name, index) => {
    const seed = hash(name);
    // 2–4 items, picked by walking the item list at a per-outfit stride, so
    // every outfit is a different set and some items land in several.
    const size = 2 + (seed % 3);
    const stride = 1 + (seed % 5);
    const itemIds: string[] = [];
    for (let step = 0; step < size && items.length > 0; step += 1) {
      const item = items[(seed + step * stride) % items.length];
      if (!itemIds.includes(item._id)) itemIds.push(item._id);
    }
    // Wear history: the first few outfits are the worn ones, the tail is
    // aspirational — which is exactly the shape §9 and the wear-again rail
    // need in order to look like anything.
    const wearCount = Math.max(0, 6 - index * 2 + (seed % 4));
    const wearDates = Array.from({ length: wearCount }, (_, w) => daysAgo(index + w * 6 + (seed % 5)));
    return { id: `outfit-${index}`, name, occasion: OCCASIONS[index], itemIds, wearDates };
  });

  const wearCounts = new Map<string, number>();
  const lastWorn = new Map<string, string | null>();
  for (const item of items) {
    wearCounts.set(item._id, 0);
    lastWorn.set(item._id, null);
  }
  for (const outfit of outfits) {
    for (const itemId of outfit.itemIds) {
      wearCounts.set(itemId, (wearCounts.get(itemId) ?? 0) + outfit.wearDates.length);
      for (const date of outfit.wearDates) {
        const current = lastWorn.get(itemId) ?? null;
        if (current === null || date > current) lastWorn.set(itemId, date);
      }
    }
  }
  return { outfits, wearCounts, lastWorn };
}

export function useWardrobeData(): WardrobeData {
  const items = useQuery(api.items.list, {});
  if (items === undefined) {
    return { loading: true, items: [], outfits: [], wearCounts: new Map(), lastWorn: new Map() };
  }
  return { loading: false, items, ...synthesize(items) };
}

/** Outfits worn at least once, most recent first — §7's wear-again rail. */
export function wearAgain(outfits: Outfit[]): Outfit[] {
  return outfits
    .filter((outfit) => outfit.wearDates.length > 0)
    .sort((a, b) => (b.wearDates[0] ?? '').localeCompare(a.wearDates[0] ?? ''))
    .slice(0, 5);
}

export function label(item: Item): string {
  return item.name ?? item.category;
}

export function coverOf(outfit: Outfit, items: Item[]): Item | undefined {
  return items.find((item) => item._id === outfit.itemIds[0]);
}
