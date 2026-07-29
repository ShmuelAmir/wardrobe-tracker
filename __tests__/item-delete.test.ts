import { itemStatsQuery } from '@/db/queries';
import { item, outfit, outfitItem, wearEvent } from '@/db/schema';
import {
  deleteItem,
  planItemDelete,
  readItemDeleteImpact,
  type DeleteImpactOutfit,
} from '@/item-delete';
import { logWear } from '@/wear-log';

/**
 * §8.3 / §8.4 — the item delete, end to end. `planItemDelete` is proven as a
 * pure function of the impact (the confirm *is* its return value, so the interface
 * is the test surface); the read and the cascade are proven against the in-memory
 * better-sqlite3 the other query suites use, because they are claims about **SQL
 * cascades** (`PRAGMA foreign_keys = ON`, ADR-0005) a mock could not make.
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

// The filesystem half of §4.5. Sampling the row count *at unlink time* — not
// just recording that an unlink happened — is what lets a test assert the
// ordering rule rather than merely the two effects.
const mockUnlinked: string[] = [];
let mockUnlinkThrows = false;
let mockRowsAtUnlink: number | null = null;
jest.mock('@/item-images', () => ({
  itemImageFile: (imageFile: string) => ({
    delete: () => {
      mockUnlinked.push(imageFile);
      mockRowsAtUnlink = mockCountItems();
      if (mockUnlinkThrows) throw new Error('unlink failed');
    },
  }),
}));

const { db } = require('@/db/client') as { db: typeof import('@/db/client').db };

const mockCountItems = () => db.select().from(item).all().length;

// ─────────────────────────────────────────────────────────────────────────────
// planItemDelete — the confirm as data (pure; no database)
// ─────────────────────────────────────────────────────────────────────────────

function anOutfit(overrides: Partial<DeleteImpactOutfit> = {}): DeleteImpactOutfit {
  return { id: 1, name: 'Weekday default', itemCount: 4, wearCount: 0, ...overrides };
}

const messageFor = (outfits: DeleteImpactOutfit[]) => planItemDelete(outfits).message;

describe('planItemDelete — the item confirm reassures (§8.3)', () => {
  it('titles the confirm and says nothing else changes for an item in no outfit', () => {
    const plan = planItemDelete([]);
    expect(plan.title).toBe('Delete this item?');
    expect(plan.message).toBe('Nothing else changes.');
  });

  it('names the outfits and promises wear history is untouched', () => {
    const outfits = [
      anOutfit({ id: 1, name: 'Weekday default' }),
      anOutfit({ id: 2, name: 'Smart evening' }),
      anOutfit({ id: 3, name: 'Rainy day' }),
      anOutfit({ id: 4, name: 'Beach' }),
    ];

    expect(messageFor(outfits)).toBe(
      'Used in 4 outfits — Weekday default, Smart evening +2 more. ' +
        "They'll keep their other items, and your wear history won't change.",
    );
  });

  it('drops the "+N more" tail and singularizes at one outfit', () => {
    expect(messageFor([anOutfit({ name: 'Weekday default' })])).toBe(
      "Used in 1 outfit — Weekday default. It'll keep its other items, and your wear " +
        "history won't change.",
    );
  });

  it('falls back to the app-wide name for an untitled outfit', () => {
    expect(messageFor([anOutfit({ name: null })])).toContain('Used in 1 outfit — Untitled outfit.');
  });
});

describe('planItemDelete — the last-item third outcome (§8.4)', () => {
  it('names the outfit and the wear cost of cleaning it up', () => {
    const outfits = [anOutfit({ name: 'Weekday default', itemCount: 1, wearCount: 12 })];

    expect(messageFor(outfits)).toBe(
      "Used in 1 outfit — Weekday default. Your wear history won't change.\n\n" +
        'This is the last item in an outfit — "Weekday default".\n' +
        "Keep it and it'll have no garments left, but its 12 wears keep counting.\n" +
        'Delete it too and those 12 wears disappear from your stats.',
    );
  });

  it('agrees verb and article at a single wear', () => {
    const message = messageFor([anOutfit({ itemCount: 1, wearCount: 1 })]);

    expect(message).toContain('but its 1 wear keeps counting.');
    expect(message).toContain('Delete it too and that 1 wear disappears from your stats.');
  });

  it('never dangles a wear promise when the doomed outfit was never worn', () => {
    const message = messageFor([anOutfit({ itemCount: 1, wearCount: 0 })]);

    expect(message).toContain("Keep it and it'll have no garments left.");
    expect(message).not.toContain('wears');
  });

  it('pluralizes the whole paragraph across several last-item outfits', () => {
    const outfits = [
      anOutfit({ id: 1, name: 'Weekday default', itemCount: 1, wearCount: 12 }),
      anOutfit({ id: 2, name: 'Smart evening', itemCount: 1, wearCount: 3 }),
    ];

    expect(messageFor(outfits)).toBe(
      "Used in 2 outfits — Weekday default, Smart evening. Your wear history won't change.\n\n" +
        'This is the last item in 2 outfits — "Weekday default", "Smart evening".\n' +
        "Keep them and they'll have no garments left, but their 15 wears keep counting.\n" +
        'Delete them too and those 15 wears disappear from your stats.',
    );
  });

  it('reassures only about the outfits that actually survive with garments', () => {
    const outfits = [
      anOutfit({ id: 1, name: 'Weekday default', itemCount: 4 }),
      anOutfit({ id: 2, name: 'Smart evening', itemCount: 1, wearCount: 3 }),
    ];

    expect(messageFor(outfits)).toContain(
      "The others keep their remaining items, and your wear history won't change.",
    );
  });
});

describe('planItemDelete — item-only is the default, cleanup is opt-in (§8.4)', () => {
  it('offers a single destructive action when no outfit is emptied', () => {
    expect(planItemDelete([anOutfit({ itemCount: 4 })]).actions).toEqual([
      { label: 'Delete Item', style: 'destructive', outfitIds: [] },
    ]);
  });

  it('offers the third outcome, singular, when one outfit is emptied', () => {
    expect(planItemDelete([anOutfit({ id: 7, itemCount: 1 })]).actions).toEqual([
      { label: 'Delete item only', style: 'default', outfitIds: [] },
      { label: 'Delete item + outfit', style: 'destructive', outfitIds: [7] },
    ]);
  });

  it('counts the outfits in the cleanup label when several are emptied', () => {
    const actions = planItemDelete([
      anOutfit({ id: 7, itemCount: 1 }),
      anOutfit({ id: 8, itemCount: 1 }),
    ]).actions;

    expect(actions[1].label).toBe('Delete item + 2 outfits');
  });

  it('carries exactly the last-item outfit ids on the cleanup action — the one rule the message and the button share (§8.4)', () => {
    const actions = planItemDelete([
      anOutfit({ id: 1, name: 'Weekday default', itemCount: 4 }), // survives — not carried
      anOutfit({ id: 2, name: 'Smart evening', itemCount: 1 }), // emptied — carried
    ]).actions;

    expect(actions[1].outfitIds).toEqual([2]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// readItemDeleteImpact + deleteItem — against a real SQLite cascade
// ─────────────────────────────────────────────────────────────────────────────

function seedItems(...ids: number[]) {
  db.insert(item)
    .values(ids.map((id) => ({ id, imageFile: `${id}.jpg`, category: 'Top' as const })))
    .run();
}

function seedOutfit(id: number, itemIds: number[], name: string | null = `Outfit ${id}`) {
  db.insert(outfit).values({ id, name }).run();
  if (itemIds.length > 0) {
    db.insert(outfitItem)
      .values(itemIds.map((itemId) => ({ outfitId: id, itemId })))
      .run();
  }
}

const wearCountOf = (itemId: number) => itemStatsQuery(db, itemId).all()[0].wearCount;
const outfitIds = () => db.select().from(outfit).all().map((row) => row.id);
const itemIds = () => db.select().from(item).all().map((row) => row.id);
const itemIdsIn = (id: number) =>
  db
    .select()
    .from(outfitItem)
    .all()
    .filter((row) => row.outfitId === id)
    .map((row) => row.itemId);

beforeEach(() => {
  db.delete(wearEvent).run();
  db.delete(outfit).run();
  db.delete(item).run();
  mockUnlinked.length = 0;
  mockRowsAtUnlink = null;
  mockUnlinkThrows = false;
});

describe('readItemDeleteImpact — what the item confirm is allowed to claim', () => {
  it('reads nothing for an item in no outfit', () => {
    seedItems(1);

    expect(readItemDeleteImpact(1)).toEqual([]);
  });

  it('carries each containing outfit with its own item and wear counts', () => {
    seedItems(1, 2);
    seedOutfit(10, [1, 2], 'Weekday default');
    seedOutfit(20, [1], 'Smart evening');
    logWear(10, '2026-07-20');
    logWear(10, '2026-07-21');
    logWear(20, '2026-07-22');

    expect(readItemDeleteImpact(1)).toEqual([
      { id: 20, name: 'Smart evening', itemCount: 1, wearCount: 1 },
      { id: 10, name: 'Weekday default', itemCount: 2, wearCount: 2 },
    ]);
  });

  it('ignores outfits that do not contain the item', () => {
    seedItems(1, 2);
    seedOutfit(10, [2]);

    expect(readItemDeleteImpact(1)).toEqual([]);
  });
});

describe('deleteItem — nearly harmless, and row-first (§4.5, §8.3)', () => {
  it('leaves the outfits intact minus that garment, with wear history unchanged', () => {
    seedItems(1, 2);
    seedOutfit(10, [1, 2]);
    logWear(10, '2026-07-20');
    logWear(10, '2026-07-21');

    deleteItem(1, '1.jpg');

    expect(itemIds()).toEqual([2]);
    expect(outfitIds()).toEqual([10]);
    expect(itemIdsIn(10)).toEqual([2]);
    // The surviving garment's derived count is untouched — no wear event died.
    expect(wearCountOf(2)).toBe(2);
  });

  it('removes the row before the file — always fail toward an orphan (ADR-0008)', () => {
    seedItems(1);

    deleteItem(1, '1.jpg');

    expect(mockUnlinked).toEqual(['1.jpg']);
    // Zero rows at the moment the unlink ran: the row was already gone, so a
    // kill here leaves a file with no row, never a row with no file.
    expect(mockRowsAtUnlink).toBe(0);
  });

  it('swallows a failed unlink rather than rolling back a delete the user asked for', () => {
    seedItems(1);
    mockUnlinkThrows = true;

    expect(() => deleteItem(1, '1.jpg')).not.toThrow();
    expect(itemIds()).toEqual([]);
  });

  it('leaves a reachable zero-item outfit whose wears still count when cleanup is declined', () => {
    seedItems(1);
    seedOutfit(10, [1], 'Weekday default');
    logWear(10, '2026-07-20');

    deleteItem(1, '1.jpg');

    expect(outfitIds()).toEqual([10]);
    expect(itemIdsIn(10)).toEqual([]);
    // The outfit survives, garment-less, and its wear event is still on record —
    // those wears really did happen (§8.4).
    expect(db.select().from(wearEvent).all()).toHaveLength(1);
  });

  it('takes the named outfits with it when cleanup is opted into, and only those', () => {
    seedItems(1, 2);
    seedOutfit(10, [1], 'Weekday default');
    seedOutfit(20, [1, 2], 'Smart evening');
    logWear(10, '2026-07-20');
    logWear(20, '2026-07-21');

    deleteItem(1, '1.jpg', [10]);

    expect(outfitIds()).toEqual([20]);
    expect(itemIds()).toEqual([2]);
    // Outfit 10's wear died with it; outfit 20's did not.
    expect(wearCountOf(2)).toBe(1);
    expect(mockUnlinked).toEqual(['1.jpg']);
  });
});
