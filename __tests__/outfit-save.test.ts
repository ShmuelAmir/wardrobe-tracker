import { eq } from 'drizzle-orm';

import { collapseWhitespace, resolveOccasion, saveOutfit } from '@/outfit-save';
import { OCCASION_CHIP_CAP, occasionChipsQuery } from '@/db/queries';
import { item, outfit, outfitItem } from '@/db/schema';

/**
 * §6.2's normalization is a database rule — "match case-insensitively against
 * existing occasions" — so it can only be proven against a real SQLite, not a
 * mocked one. This runs `saveOutfit` for real against an in-memory better-sqlite3
 * loaded with the app's own migrations, mirroring `schema-migrations.test.ts`.
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

// The mocked module's real db, to read rows back and reset between tests.
const { db } = require('@/db/client') as { db: typeof import('@/db/client').db };

function seedItems(...ids: number[]) {
  db.insert(item)
    .values(ids.map((id) => ({ id, imageFile: `${id}.jpg`, category: 'Top' as const })))
    .run();
}

function readOutfit(id: number) {
  return db.select().from(outfit).where(eq(outfit.id, id)).get();
}

beforeEach(() => {
  // Deleting outfits cascades to outfit_item; items are independent.
  db.delete(outfit).run();
  db.delete(item).run();
});

describe('collapseWhitespace', () => {
  it('trims and collapses internal runs to single spaces', () => {
    expect(collapseWhitespace('  work   formal ')).toBe('work formal');
  });

  it('reduces a blank string to empty', () => {
    expect(collapseWhitespace('   ')).toBe('');
  });
});

/**
 * §6.2 — the three-row table from the spec, proven against the DB: a
 * case-insensitive hit reuses the **existing** spelling; a miss stores the value
 * as typed; and `NYE` is never mangled to `Nye`.
 */
describe('resolveOccasion — first spelling wins', () => {
  it('reuses the existing spelling when a case-insensitive match exists', () => {
    seedItems(1);
    saveOutfit({ name: null, occasion: 'Work', itemIds: [1] });

    expect(resolveOccasion('  work ')).toBe('Work');
    expect(resolveOccasion('WORK')).toBe('Work');
  });

  it('stores a genuinely new occasion exactly as typed', () => {
    seedItems(1);
    saveOutfit({ name: null, occasion: 'Work', itemIds: [1] });

    expect(resolveOccasion('Shul')).toBe('Shul');
  });

  it('treats an empty or whitespace-only occasion as null', () => {
    expect(resolveOccasion('   ')).toBeNull();
    expect(resolveOccasion(null)).toBeNull();
  });
});

/**
 * §6.1 — committing writes the outfit and its join rows in one go and returns
 * the new id so the caller can land on Detail (§6.1.5).
 */
describe('saveOutfit', () => {
  it('normalizes a reused occasion at save — "  work " with "Work" present stores "Work"', () => {
    seedItems(1, 2);
    saveOutfit({ name: 'First', occasion: 'Work', itemIds: [1] });

    const id = saveOutfit({ name: 'Second', occasion: '  work ', itemIds: [2] });

    expect(readOutfit(id)?.occasion).toBe('Work');
  });

  it('stores a brand-new occasion unmangled — "NYE" stays "NYE"', () => {
    seedItems(1);

    const id = saveOutfit({ name: null, occasion: 'NYE', itemIds: [1] });

    expect(readOutfit(id)?.occasion).toBe('NYE');
  });

  it('writes one join row per selected item', () => {
    seedItems(1, 2, 3);

    const id = saveOutfit({ name: 'Look', occasion: null, itemIds: [3, 1, 2] });

    const joins = db.select().from(outfitItem).where(eq(outfitItem.outfitId, id)).all();
    expect(joins.map((row) => row.itemId).sort()).toEqual([1, 2, 3]);
  });

  it('collapses the name and stores null for an empty one', () => {
    seedItems(1);

    const named = saveOutfit({ name: '  Smart  evening ', occasion: null, itemIds: [1] });
    const blank = saveOutfit({ name: '   ', occasion: null, itemIds: [1] });

    expect(readOutfit(named)?.name).toBe('Smart evening');
    expect(readOutfit(blank)?.name).toBeNull();
  });
});

/**
 * §6.2 — the chip vocabulary the Save sheet draws from: built from history,
 * most-used first (alphabetical tiebreak), folded case-insensitively, and capped
 * at 8. A fresh install returns nothing — chips accrete from outfit #2, no
 * seeding.
 */
describe('occasionChipsQuery — self-building vocabulary', () => {
  const chips = () =>
    occasionChipsQuery(db)
      .all()
      .map((row) => row.occasion);

  it('returns nothing on a fresh install', () => {
    expect(chips()).toEqual([]);
  });

  it('orders most-used first, then alphabetically', () => {
    saveOutfit({ name: null, occasion: 'Work', itemIds: [] });
    saveOutfit({ name: null, occasion: 'Work', itemIds: [] });
    saveOutfit({ name: null, occasion: 'Shul', itemIds: [] });
    saveOutfit({ name: null, occasion: 'Gym', itemIds: [] });

    // Work (2) leads; Gym and Shul both have 1, so alphabetical breaks the tie.
    expect(chips()).toEqual(['Work', 'Gym', 'Shul']);
  });

  it('breaks equal-count ties alphabetically, case-insensitively', () => {
    // ASCII order would put "Bag" (uppercase B, 66) before "apron" (lowercase
    // a, 97); a true alphabetical tiebreak keeps "apron" first.
    saveOutfit({ name: null, occasion: 'Bag', itemIds: [] });
    saveOutfit({ name: null, occasion: 'apron', itemIds: [] });

    expect(chips()).toEqual(['apron', 'Bag']);
  });

  it('folds casing into one chip via COLLATE NOCASE', () => {
    // First spelling ("Work") is canonical, and "work" reuses it — so both the
    // count and the chip label converge on the one spelling.
    saveOutfit({ name: null, occasion: 'Work', itemIds: [] });
    saveOutfit({ name: null, occasion: 'work', itemIds: [] });

    expect(chips()).toEqual(['Work']);
  });

  it('caps the vocabulary at 8, dropping the long tail', () => {
    for (let n = 0; n < 10; n += 1) {
      saveOutfit({ name: null, occasion: `Occasion ${n}`, itemIds: [] });
    }

    expect(chips()).toHaveLength(OCCASION_CHIP_CAP);
  });
});
