import { eq } from 'drizzle-orm';

import { logWear, removeWear, toIsoDate } from '@/wear-log';
import {
  itemWearCountQuery,
  outfitStatsQuery,
  wearHistoryQuery,
} from '@/db/queries';
import { item, outfit, outfitItem, wearEvent } from '@/db/schema';

/**
 * Wear stats are a **database rule** — count/min/max over `wear_event`, and a
 * per-item count that reaches through the join (§3, §8.5) — so they're proven
 * against a real SQLite, the same in-memory better-sqlite3 the outfit-save
 * tests use.
 */
jest.mock('@/db/client', () => {
  const BetterSqlite3 = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
  const schema = require('@/db/schema');
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db };
});

const { db } = require('@/db/client') as { db: typeof import('@/db/client').db };

function seedItems(...ids: number[]) {
  db.insert(item)
    .values(ids.map((id) => ({ id, imageFile: `${id}.jpg`, category: 'Top' as const })))
    .run();
}

function seedOutfit(id: number, itemIds: number[]) {
  db.insert(outfit).values({ id, name: `Outfit ${id}` }).run();
  if (itemIds.length > 0) {
    db.insert(outfitItem)
      .values(itemIds.map((itemId) => ({ outfitId: id, itemId })))
      .run();
  }
}

const stats = (id: number) => outfitStatsQuery(db, id).get();
const history = (id: number) =>
  wearHistoryQuery(db, id)
    .all()
    .map((row) => row.wornOn);
const itemCount = (itemId: number) => itemWearCountQuery(db, itemId).get()?.count ?? 0;

beforeEach(() => {
  db.delete(outfit).run();
  db.delete(item).run();
});

describe('toIsoDate — local day-granular', () => {
  it('formats a date as YYYY-MM-DD with zero padding', () => {
    expect(toIsoDate(new Date(2026, 0, 3))).toBe('2026-01-03');
    expect(toIsoDate(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});

/**
 * §8.5 — one `wear_event` per log; `removeWear` deletes exactly the row just
 * written (the toast Undo and history-sheet Remove share this path).
 */
describe('logWear / removeWear', () => {
  it('writes one wear event and returns its id', () => {
    seedItems(1);
    seedOutfit(10, [1]);

    const eventId = logWear(10, '2026-07-23');

    const rows = db.select().from(wearEvent).where(eq(wearEvent.outfitId, 10)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(eventId);
    expect(rows[0].wornOn).toBe('2026-07-23');
  });

  it('removes exactly the event named, leaving the rest', () => {
    seedItems(1);
    seedOutfit(10, [1]);
    const first = logWear(10, '2026-07-20');
    logWear(10, '2026-07-23');

    removeWear(first);

    expect(history(10)).toEqual(['2026-07-23']);
  });
});

/**
 * §8.5 stats strip — times worn / first worn / last worn, all derived, no
 * stored counters.
 */
describe('outfitStatsQuery — derived strip', () => {
  it('reads zero and null on an outfit never worn', () => {
    seedOutfit(10, []);

    expect(stats(10)).toEqual({ timesWorn: 0, firstWorn: null, lastWorn: null });
  });

  it('counts events and reads the earliest and latest day', () => {
    seedOutfit(10, []);
    logWear(10, '2026-07-20');
    logWear(10, '2026-07-23');
    logWear(10, '2026-07-10');

    expect(stats(10)).toEqual({ timesWorn: 3, firstWorn: '2026-07-10', lastWorn: '2026-07-23' });
  });
});

/**
 * §8.5 history sheet — one row per event, most recent first.
 */
describe('wearHistoryQuery — dated rows, newest first', () => {
  it('orders by day descending', () => {
    seedOutfit(10, []);
    logWear(10, '2026-07-10');
    logWear(10, '2026-07-23');
    logWear(10, '2026-07-20');

    expect(history(10)).toEqual(['2026-07-23', '2026-07-20', '2026-07-10']);
  });
});

/**
 * The §3 invariant made concrete: wear count is **per wear-event**. Two outfits
 * sharing an item, both worn the same day, count that item twice.
 */
describe('itemWearCountQuery — per wear-event, reaches through outfits', () => {
  it('counts an item twice when two outfits sharing it are both worn today', () => {
    seedItems(1);
    seedOutfit(10, [1]);
    seedOutfit(20, [1]);
    logWear(10, '2026-07-23');
    logWear(20, '2026-07-23');

    expect(itemCount(1)).toBe(2);
  });

  it('is zero for an item in no worn outfit', () => {
    seedItems(1);
    seedOutfit(10, [1]);

    expect(itemCount(1)).toBe(0);
  });
});
