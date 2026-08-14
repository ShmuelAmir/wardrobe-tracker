import 'fake-indexeddb/auto';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetConvex, stubMutation, stubQuery } from '../../test/convex-fake';
import { anItem } from '../../test/fixtures';
import { renderRoute } from '../../test/render';
import { addItemDraftStore } from './add-item-draft';

vi.mock('convex/react', () => import('../../test/convex-fake'));

// The decode half of the pipeline is stubbed at its own module: jsdom has no
// canvas, and what these tests are about is the *walk*, not the encoder —
// `normalize-image.test.ts` owns that.
vi.mock('./normalize-image', () => ({
  normalizeImage: (file: Blob) =>
    normalizeFails
      ? Promise.reject(new Error('undecodable'))
      : Promise.resolve({ blob: file, width: 1200, height: 900 }),
}));

let normalizeFails = false;
let uploads: Blob[] = [];
let inserted: unknown[] = [];

const STORAGE_ID = 'storage_1' as Id<'_storage'>;

const aFile = () => new File(['jpeg bytes'], 'shirt.jpg', { type: 'image/jpeg' });

/** The browser's Back button, which §5.8 makes an alias for the wizard's. */
const back = (router: ReturnType<typeof renderRoute>) =>
  act(async () => {
    await router.navigate(-1);
  });

/** The wizard's two mutations plus the upload POST the client makes between them. */
function stubBackend({ insertFails = false } = {}) {
  stubMutation(api.items.generateUploadUrl, async () => 'https://upload.test/signed');
  stubMutation(api.items.create, async (args) => {
    if (insertFails && inserted.length === 0) {
      inserted.push('attempt');
      throw new Error('insert failed');
    }
    inserted.push(args);
    return 'item_1' as Id<'items'>;
  });

  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    uploads.push(init.body as Blob);
    return { ok: true, json: async () => ({ storageId: STORAGE_ID }) } as Response;
  });
}

/** Walk from the source step to Review with an image in the draft. */
async function walkToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(await screen.findByLabelText(/upload a file/i), aFile());
  await screen.findByRole('button', { name: 'Use this photo' });
  await user.click(screen.getByRole('button', { name: 'Use this photo' }));
  await screen.findByRole('button', { name: 'Save' });
}

async function fillAndSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Top' }));
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

beforeEach(async () => {
  resetConvex();
  stubQuery(api.items.list, [anItem()]);
  normalizeFails = false;
  uploads = [];
  inserted = [];
  await addItemDraftStore.drop();
});

afterEach(() => vi.unstubAllGlobals());

describe('the wizard is a walk of real routes', () => {
  it('steps forward through its routes as the user picks and confirms', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');

    await user.upload(await screen.findByLabelText(/upload a file/i), aFile());

    await waitFor(() => expect(router.state.location.pathname).toBe('/add/confirm'));

    await user.click(screen.getByRole('button', { name: 'Use this photo' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/add/review'));
  });

  it('makes browser Back the wizard’s Back', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');
    await walkToReview(user);

    await back(router);

    await waitFor(() => expect(router.state.location.pathname).toBe('/add/confirm'));
    expect(screen.getByRole('button', { name: 'Use this photo' })).toBeDefined();
  });

  it('lands Back from Saved on the wardrobe, never on the submitted form', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');
    await walkToReview(user);
    await fillAndSave(user);
    await waitFor(() => expect(router.state.location.pathname).toBe('/add/saved'));

    await back(router);

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    // The submitted form is not merely off-screen: its history entry was
    // consumed by `saved`, and the step below it has no draft left to render.
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('bounces a deep link into a step with no captured image', async () => {
    stubBackend();
    const router = renderRoute('/add/review');

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('keeps the source step live when a file cannot be read', async () => {
    const user = userEvent.setup();
    stubBackend();
    normalizeFails = true;
    const router = renderRoute('/add');

    await user.upload(await screen.findByLabelText(/upload a file/i), aFile());

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(router.state.location.pathname).toBe('/add');
    expect(screen.getByLabelText(/upload a file/i)).toBeDefined();
  });
});

describe('the image is uploaded on submit, not on pick', () => {
  it('previews the picked image without storing anything', async () => {
    const user = userEvent.setup();
    stubBackend();
    renderRoute('/add');

    await walkToReview(user);

    expect(uploads).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it('uploads once and inserts the row when Save is pressed', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');
    await walkToReview(user);

    await fillAndSave(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/add/saved'));
    expect(uploads).toHaveLength(1);
    expect(inserted).toEqual([{ image: STORAGE_ID, category: 'Top' }]);
  });

  it('retries a failed insert against the same storage id, with no second upload', async () => {
    const user = userEvent.setup();
    stubBackend({ insertFails: true });
    const router = renderRoute('/add');
    await walkToReview(user);

    await fillAndSave(user);
    expect(await screen.findByRole('alert')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/add/saved'));
    expect(uploads).toHaveLength(1);
    expect(inserted[1]).toEqual({ image: STORAGE_ID, category: 'Top' });
  });
});

describe('Review & fill', () => {
  it('requires a category and nothing else', async () => {
    const user = userEvent.setup();
    stubBackend();
    renderRoute('/add');
    await walkToReview(user);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);

    await user.click(screen.getByRole('button', { name: 'Bag' }));

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
  });

  it('carries the optional fields through, and omits the ones left blank', async () => {
    const user = userEvent.setup();
    stubBackend();
    renderRoute('/add');
    await walkToReview(user);

    await user.click(screen.getByRole('button', { name: 'Outerwear' }));
    await user.type(screen.getByLabelText('Name'), '  wool coat  ');
    await user.click(screen.getByRole('button', { name: 'Winter' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(inserted).toHaveLength(1));
    expect(inserted[0]).toEqual({
      image: STORAGE_ID,
      category: 'Outerwear',
      name: 'wool coat',
      brand: undefined,
      season: ['winter'],
    });
  });
});

describe('the draft persists', () => {
  it('resumes a cold load of Review with the image still in hand', async () => {
    const user = userEvent.setup();
    stubBackend();
    renderRoute('/add');
    await walkToReview(user);

    // A reload: everything in memory is thrown away and the app mounts afresh
    // at the URL it was on, with only the IndexedDB record to resume from.
    cleanup();
    const router = renderRoute('/add/review');

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/add/review');
    expect(await screen.findByRole('img', { name: /picked/i })).toBeDefined();
  });

  it('drops the record on a successful save', async () => {
    const user = userEvent.setup();
    stubBackend();
    renderRoute('/add');
    await walkToReview(user);

    await fillAndSave(user);

    await waitFor(async () => expect(await addItemDraftStore.read()).toBeNull());
  });

  it('drops the record on an explicit Cancel', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');
    await walkToReview(user);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    await waitFor(async () => expect(await addItemDraftStore.read()).toBeNull());
  });
});
