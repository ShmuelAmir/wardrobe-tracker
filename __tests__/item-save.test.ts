import { resizePlan, saveItem } from '@/item-save';
import { item } from '@/db/schema';

const mockRun = jest.fn();
const mockValues = jest.fn((..._args: unknown[]) => ({ run: mockRun }));
const mockInsert = jest.fn((..._args: unknown[]) => ({ values: mockValues }));
jest.mock('@/db/client', () => ({ db: { insert: (...args: unknown[]) => mockInsert(...args) } }));

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
