import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';

import { enableForeignKeys } from '@/db/client';
import { item, outfit, outfitItem, wearEvent } from '@/db/schema';

/**
 * The generated migrations are the only thing that ever builds a real device's
 * tables, so these run them for real — against an in-memory SQLite — rather
 * than asserting on the Drizzle schema objects, which cannot tell you whether
 * drizzle-kit actually emitted what the schema describes.
 *
 * `better-sqlite3` defaults foreign keys OFF exactly like expo-sqlite does, so
 * the cascades below only fire if `enableForeignKeys` — the *app's own* pragma,
 * imported rather than restated — actually works (§10.1).
 */
function freshDatabase() {
  const sqlite = new Database(':memory:');
  enableForeignKeys({ execSync: (sql) => void sqlite.exec(sql) });
  const db = drizzle(sqlite, { schema: { item, outfit, outfitItem, wearEvent } });
  migrate(db, { migrationsFolder: './drizzle' });
  return { sqlite, db };
}

describe('migrations', () => {
  it('creates all four tables on a fresh install', () => {
    const { sqlite } = freshDatabase();

    const names = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(names).toEqual(expect.arrayContaining(['item', 'outfit', 'outfit_item', 'wear_event']));
  });

  it('stores no wear counters — stats are derived, never stored (§3.1)', () => {
    const { sqlite } = freshDatabase();

    const columns = ['item', 'outfit', 'outfit_item', 'wear_event'].flatMap((table) =>
      sqlite
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((row) => (row as { name: string }).name),
    );

    expect(columns).not.toContain('wear_count');
    expect(columns).not.toContain('last_worn');
  });

  it('keeps category free of a SQL CHECK constraint (§3.1 rule 1)', () => {
    const { sqlite } = freshDatabase();

    const ddl = sqlite
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'item'")
      .get() as { sql: string };

    expect(ddl.sql).not.toMatch(/CHECK/i);
  });
});

describe('schema shape', () => {
  it('round-trips season as a nullable JSON array and image_file as a bare filename', () => {
    const { db } = freshDatabase();

    db.insert(item)
      .values([
        { imageFile: 'a3f2c1de.jpg', category: 'Outerwear', season: ['winter', 'fall'] },
        { imageFile: 'b7e4d0aa.jpg', category: 'Top' },
      ])
      .run();

    const rows = db.select().from(item).all();

    expect(rows[0].season).toEqual(['winter', 'fall']);
    expect(rows[0].imageFile).toBe('a3f2c1de.jpg');
    expect(rows[1].season).toBeNull();
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it('keys outfit_item on the (outfit, item) pair — an item joins an outfit once', () => {
    const { db } = freshDatabase();
    db.insert(item).values({ id: 1, imageFile: 'a.jpg', category: 'Top' }).run();
    db.insert(outfit).values({ id: 1, name: 'Monday' }).run();
    db.insert(outfitItem).values({ outfitId: 1, itemId: 1 }).run();

    expect(() => db.insert(outfitItem).values({ outfitId: 1, itemId: 1 }).run()).toThrow(
      /UNIQUE constraint/i,
    );
  });

  it('stores worn_on at day granularity', () => {
    const { db } = freshDatabase();
    db.insert(outfit).values({ id: 1 }).run();

    db.insert(wearEvent).values({ outfitId: 1, wornOn: '2026-07-20' }).run();

    expect(db.select().from(wearEvent).all()[0].wornOn).toBe('2026-07-20');
  });
});

describe('foreign key cascades (§3.1 rule 5)', () => {
  it('rejects a wear event for an outfit that does not exist', () => {
    const { db } = freshDatabase();

    expect(() => db.insert(wearEvent).values({ outfitId: 99, wornOn: '2026-07-20' }).run()).toThrow(
      /FOREIGN KEY constraint/i,
    );
  });

  it('deleting an item drops its outfit_item rows but leaves the outfit and its wear history', () => {
    const { db } = freshDatabase();
    db.insert(item)
      .values([
        { id: 1, imageFile: 'a.jpg', category: 'Top' },
        { id: 2, imageFile: 'b.jpg', category: 'Bottom' },
      ])
      .run();
    db.insert(outfit).values({ id: 1, name: 'Monday' }).run();
    db.insert(outfitItem)
      .values([
        { outfitId: 1, itemId: 1 },
        { outfitId: 1, itemId: 2 },
      ])
      .run();
    db.insert(wearEvent).values({ outfitId: 1, wornOn: '2026-07-20' }).run();

    db.delete(item).where(eq(item.id, 1)).run();

    expect(db.select().from(outfitItem).all()).toEqual([{ outfitId: 1, itemId: 2 }]);
    expect(db.select().from(outfit).all()).toHaveLength(1);
    expect(db.select().from(wearEvent).all()).toHaveLength(1);
  });

  it('deleting an outfit cascades to its outfit_item and wear_event rows, sparing the items', () => {
    const { db } = freshDatabase();
    db.insert(item).values({ id: 1, imageFile: 'a.jpg', category: 'Top' }).run();
    db.insert(outfit).values({ id: 1, name: 'Monday' }).run();
    db.insert(outfitItem).values({ outfitId: 1, itemId: 1 }).run();
    db.insert(wearEvent).values({ outfitId: 1, wornOn: '2026-07-20' }).run();

    db.delete(outfit).where(eq(outfit.id, 1)).run();

    expect(db.select().from(outfitItem).all()).toEqual([]);
    expect(db.select().from(wearEvent).all()).toEqual([]);
    expect(db.select().from(item).all()).toHaveLength(1);
  });
});
