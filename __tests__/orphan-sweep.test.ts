import { deleteItem } from '@/deletes';
import { item } from '@/db/schema';
import { sweepOrphanImages } from '@/orphan-sweep';

/**
 * §4.6 / ADR-0008 — the reconciliation that keeps disk and database honest.
 *
 * The diff is the whole feature, so both of its sides are real here: the
 * `image_file` column is read out of the same in-memory better-sqlite3 the
 * other query suites use, and the directory listing comes from the real
 * `item-images` over a fake filesystem. Mocking the sweep's own diff would
 * leave nothing under test.
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

/**
 * A disk: bare filenames under `document/items`. Mutating it *is* the
 * assertion surface — what survives a sweep is what the app would still be
 * able to render.
 */
const mockDisk = new Set<string>();
const mockSubdirectories = new Set<string>();
const mockUnlinkFailures = new Set<string>();
let mockItemsDirectoryExists = true;
let mockListThrows = false;

jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join('/');
    }
    get name() {
      return this.uri.split('/').pop() as string;
    }
    delete() {
      if (mockUnlinkFailures.has(this.name)) throw new Error(`locked: ${this.name}`);
      mockDisk.delete(this.name);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join('/');
    }
    get name() {
      return this.uri.split('/').pop() as string;
    }
    get exists() {
      return mockItemsDirectoryExists;
    }
    create() {
      mockItemsDirectoryExists = true;
    }
    list() {
      if (mockListThrows) throw new Error('listing failed');
      return [
        ...[...mockDisk].map((name) => new File('doc/items', name)),
        ...[...mockSubdirectories].map((name) => new Directory('doc/items', name)),
      ];
    }
  }
  return {
    File,
    Directory,
    Paths: { document: 'doc', join: (...parts: string[]) => parts.join('/') },
  };
});

const { db } = require('@/db/client') as { db: typeof import('@/db/client').db };

/** A row and the file it references — the honest, reconciled pair. */
function seedItem(id: number, imageFile = `${id}.jpg`) {
  db.insert(item).values({ id, imageFile, category: 'Top' as const }).run();
  mockDisk.add(imageFile);
}

const onDisk = () => [...mockDisk].sort();
const imageFiles = () =>
  db
    .select()
    .from(item)
    .all()
    .map((row) => row.imageFile)
    .sort();

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  db.delete(item).run();
  mockDisk.clear();
  mockSubdirectories.clear();
  mockUnlinkFailures.clear();
  mockItemsDirectoryExists = true;
  mockListThrows = false;
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
});

describe('the diff — a file with no row goes, a file with a row stays', () => {
  it('unlinks a stray and leaves every referenced file alone', () => {
    seedItem(1);
    seedItem(2);
    mockDisk.add('stray.jpg');

    sweepOrphanImages();

    expect(onDisk()).toEqual(['1.jpg', '2.jpg']);
  });

  it('unlinks every stray in one pass, not just the first', () => {
    seedItem(1);
    mockDisk.add('a.jpg');
    mockDisk.add('b.jpg');
    mockDisk.add('c.jpg');

    sweepOrphanImages();

    expect(onDisk()).toEqual(['1.jpg']);
  });

  it('deletes no rows — the sweep only ever touches the filesystem', () => {
    seedItem(1);
    mockDisk.add('stray.jpg');

    sweepOrphanImages();

    expect(imageFiles()).toEqual(['1.jpg']);
  });

  it('leaves an all-reconciled wardrobe untouched', () => {
    seedItem(1);
    seedItem(2);

    sweepOrphanImages();

    expect(onDisk()).toEqual(['1.jpg', '2.jpg']);
  });

  it('empties the directory when the wardrobe has no rows at all', () => {
    mockDisk.add('a.jpg');
    mockDisk.add('b.jpg');

    sweepOrphanImages();

    expect(onDisk()).toEqual([]);
  });

  it('leaves subdirectories alone — the diff is over files', () => {
    mockSubdirectories.add('nested');

    sweepOrphanImages();

    expect([...mockSubdirectories]).toEqual(['nested']);
  });
});

describe('both orphan sources', () => {
  it('reclaims the file an interrupted delete left behind', () => {
    seedItem(1);
    seedItem(2);
    // §4.5 is row-first and swallows a failed unlink, so this is exactly the
    // state a delete killed after the row commit leaves on disk.
    mockUnlinkFailures.add('1.jpg');
    deleteItem(1, '1.jpg');
    mockUnlinkFailures.clear();

    expect(onDisk()).toEqual(['1.jpg', '2.jpg']);

    sweepOrphanImages();

    expect(onDisk()).toEqual(['2.jpg']);
  });

  it('reclaims the file a save killed between the move and the insert left behind', () => {
    seedItem(1);
    // §4.4 saves file-first, so a process death after the move and before the
    // insert leaves the normalized image under its UUID name with no row.
    mockDisk.add('9d4c-uuid.jpg');

    sweepOrphanImages();

    expect(onDisk()).toEqual(['1.jpg']);
  });
});

describe('it never surfaces and never blocks', () => {
  it('survives a directory that does not exist yet, and creates nothing', () => {
    mockItemsDirectoryExists = false;

    expect(() => sweepOrphanImages()).not.toThrow();
    expect(mockItemsDirectoryExists).toBe(false);
  });

  it('survives a listing that throws', () => {
    mockListThrows = true;

    expect(() => sweepOrphanImages()).not.toThrow();
  });

  it('keeps sweeping the rest when one unlink fails', () => {
    mockDisk.add('locked.jpg');
    mockDisk.add('stray.jpg');
    mockUnlinkFailures.add('locked.jpg');

    expect(() => sweepOrphanImages()).not.toThrow();
    expect(onDisk()).toEqual(['locked.jpg']);
  });

  it('logs rather than raising when it reclaims something', () => {
    mockDisk.add('stray.jpg');

    sweepOrphanImages();

    expect(logSpy).toHaveBeenCalled();
  });

  it('says nothing at all when there is nothing to reclaim', () => {
    seedItem(1);

    sweepOrphanImages();

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
