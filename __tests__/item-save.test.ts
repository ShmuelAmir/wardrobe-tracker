import { updateItem, resizePlan, saveItem } from '@/item-save';
import { item } from '@/db/schema';

const mockRun = jest.fn();
const mockValues = jest.fn((..._args: unknown[]) => ({ run: mockRun }));
const mockInsert = jest.fn((..._args: unknown[]) => ({ values: mockValues }));
const mockWhere = jest.fn((..._args: unknown[]) => ({ run: mockRun }));
const mockSet = jest.fn((..._args: unknown[]) => ({ where: mockWhere }));
const mockUpdate = jest.fn((..._args: unknown[]) => ({ set: mockSet }));
jest.mock('@/db/client', () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

// `eq(item.id, id)` — a where predicate we only need to be able to render and
// assert on shape; a tagged tuple stands in for drizzle's SQL wrapper.
jest.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
}));

const mockResize = jest.fn();
const mockSaveAsync = jest.fn(async () => ({ uri: 'file:///cache/ImageManipulator/out.jpg' }));
const mockManipulate = jest.fn((..._args: unknown[]) => ({
  resize: mockResize,
  renderAsync: async () => ({ saveAsync: mockSaveAsync }),
}));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...args: unknown[]) => mockManipulate(...args) },
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockMoves: { from: string; to: string }[] = [];
const mockDeletes: string[] = [];
const mockDirCreates: unknown[] = [];
let mockDirExists = false;
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join('/');
    }
    move(dest: { uri: string }) {
      mockMoves.push({ from: this.uri, to: dest.uri });
    }
    delete() {
      mockDeletes.push(this.uri);
    }
  }
  class Directory {
    constructor(...parts: unknown[]) {
      void parts;
    }
    get exists() {
      return mockDirExists;
    }
    create(options: unknown) {
      mockDirCreates.push(options);
    }
  }
  return {
    File,
    Directory,
    Paths: { document: 'doc', join: (...p: string[]) => p.join('/') },
  };
});

const aCapture = (overrides = {}) => ({
  uri: 'file:///cache/pick.jpg',
  width: 4032,
  height: 3024,
  uuid: 'a3f2c1de',
  ...overrides,
});

const aFieldSet = (overrides = {}) => ({
  category: 'Top' as const,
  name: 'Grey tee',
  brand: null,
  season: null,
  sourceUrl: null,
  ...overrides,
});

// Edit's field set — the four form fields, no `source_url` (it's preserved, not
// re-derived, §5.5).
const anEditFieldSet = (overrides = {}) => ({
  category: 'Top' as const,
  name: 'Grey tee',
  brand: null,
  season: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMoves.length = 0;
  mockDeletes.length = 0;
  mockDirCreates.length = 0;
  mockDirExists = false;
});

/**
 * §4.4 — normalize at save to a 1600px longest edge, and **never upscale**. The
 * resize decision is the part with real branching (which axis, or none at all),
 * so it's pulled out as a pure function and pinned here; the AC's two size cases
 * — a 12MP original capped, an 800px image untouched — are exactly these rows.
 */
describe('resizePlan', () => {
  it('caps a landscape 12MP original on its width, the longest edge', () => {
    expect(resizePlan(4032, 3024)).toEqual({ width: 1600 });
  });

  it('caps a portrait original on its height, the longest edge', () => {
    expect(resizePlan(3024, 4032)).toEqual({ height: 1600 });
  });

  it('leaves an 800px image untouched — never upscales', () => {
    expect(resizePlan(800, 600)).toBeNull();
  });

  it('does not resize an image sitting exactly at the 1600 cap', () => {
    expect(resizePlan(1600, 1200)).toBeNull();
  });

  it('caps a square image just over the limit on its width', () => {
    expect(resizePlan(1601, 1601)).toEqual({ width: 1600 });
  });
});

/**
 * §4.4 — one pipeline, no network: manipulate → move under a UUID name → insert.
 * §4.2 — the UUID is minted at capture and the row carries the bare filename, so
 * save is a single insert, never insert-then-rename.
 */
describe('saveItem — the pipeline', () => {
  it('re-encodes to JPEG at quality 0.8', async () => {
    await saveItem(aCapture(), aFieldSet());

    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 });
  });

  it('resizes an oversized capture before saving, on its longest edge', async () => {
    await saveItem(aCapture({ width: 4032, height: 3024 }), aFieldSet());

    expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
  });

  it('leaves an already-small capture unresized', async () => {
    await saveItem(aCapture({ width: 800, height: 600 }), aFieldSet());

    expect(mockResize).not.toHaveBeenCalled();
  });

  it('moves the encoded output into the items dir under the capture UUID', async () => {
    await saveItem(aCapture({ uuid: 'a3f2c1de' }), aFieldSet());

    expect(mockMoves).toEqual([
      { from: 'file:///cache/ImageManipulator/out.jpg', to: 'doc/items/a3f2c1de.jpg' },
    ]);
  });

  it('inserts a row carrying the bare filename and the review fields', async () => {
    await saveItem(aCapture({ uuid: 'a3f2c1de' }), aFieldSet({ category: 'Bag', brand: 'Acme' }));

    expect(mockInsert).toHaveBeenCalledWith(item);
    expect(mockValues).toHaveBeenCalledWith({
      imageFile: 'a3f2c1de.jpg',
      category: 'Bag',
      name: 'Grey tee',
      brand: 'Acme',
      season: null,
      sourceUrl: null,
    });
  });

  it('creates the items directory when it does not exist yet', async () => {
    mockDirExists = false;

    await saveItem(aCapture(), aFieldSet());

    expect(mockDirCreates).toEqual([{ intermediates: true }]);
  });

  it('does not recreate the items directory once it exists', async () => {
    mockDirExists = true;

    await saveItem(aCapture(), aFieldSet());

    expect(mockDirCreates).toEqual([]);
  });

  // §4.5 — a failed insert must leave no file behind: the row never landed, so
  // the moved file is an orphan and gets unlinked. The delete is best-effort, so
  // its own failure is swallowed and the original insert error still surfaces.
  it('deletes the moved file and rethrows when the insert fails', async () => {
    const boom = new Error('constraint failed');
    mockRun.mockImplementationOnce(() => {
      throw boom;
    });

    await expect(saveItem(aCapture({ uuid: 'a3f2c1de' }), aFieldSet())).rejects.toBe(boom);
    expect(mockDeletes).toEqual(['doc/items/a3f2c1de.jpg']);
  });
});

/**
 * §8.2 Edit — the same fields committed to an existing row, in two shapes: a
 * plain field update and a replace-photo that re-runs the §4.4 pipeline. The two
 * invariants pinned here are that `source_url` is never written (preserved, §5.5)
 * and that a replace always fails toward an orphan, never a dangling reference
 * (ADR-0008): new file first, row flip, old file unlinked.
 */
describe('updateItem — fields only', () => {
  it('updates the row with the edited fields and touches no image pipeline', async () => {
    await updateItem(7, anEditFieldSet({ category: 'Bag', brand: 'Acme' }), null);

    expect(mockUpdate).toHaveBeenCalledWith(item);
    expect(mockSet).toHaveBeenCalledWith({
      category: 'Bag',
      name: 'Grey tee',
      brand: 'Acme',
      season: null,
    });
    expect(mockWhere).toHaveBeenCalledWith({ eq: [item.id, 7] });
    expect(mockManipulate).not.toHaveBeenCalled();
    expect(mockMoves).toEqual([]);
  });

  it('never writes source_url — the imported source is preserved, not re-derived', async () => {
    await updateItem(7, anEditFieldSet(), null);

    expect(mockSet.mock.calls[0][0]).not.toHaveProperty('sourceUrl');
  });
});

describe('updateItem — replace photo', () => {
  it('runs the standard pipeline, points the row at the new file, then unlinks the old', async () => {
    await updateItem(7, anEditFieldSet({ category: 'Footwear' }), {
      image: aCapture({ uuid: 'newuuid', width: 4032, height: 3024 }),
      previousImageFile: 'old.jpg',
    });

    // Normalized identically to a fresh add: resized on its longest edge, JPEG 0.8.
    expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 });
    // New file lands first, then the row flips to it.
    expect(mockMoves).toEqual([
      { from: 'file:///cache/ImageManipulator/out.jpg', to: 'doc/items/newuuid.jpg' },
    ]);
    expect(mockSet).toHaveBeenCalledWith({
      imageFile: 'newuuid.jpg',
      category: 'Footwear',
      name: 'Grey tee',
      brand: null,
      season: null,
    });
    // Old file unlinked last — an orphan now, never a dangling reference.
    expect(mockDeletes).toEqual(['doc/items/old.jpg']);
  });

  it('unlinks the just-moved new file and rethrows when the update fails — old file kept', async () => {
    const boom = new Error('update failed');
    mockRun.mockImplementationOnce(() => {
      throw boom;
    });

    await expect(
      updateItem(7, anEditFieldSet(), {
        image: aCapture({ uuid: 'newuuid' }),
        previousImageFile: 'old.jpg',
      }),
    ).rejects.toBe(boom);

    // The new file is the orphan; the old file the row still points at is untouched.
    expect(mockDeletes).toEqual(['doc/items/newuuid.jpg']);
  });
});
