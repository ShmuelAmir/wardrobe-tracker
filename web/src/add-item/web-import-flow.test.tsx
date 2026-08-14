import 'fake-indexeddb/auto';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetConvex, setConnected, stubAction, stubMutation, stubQuery } from '../../test/convex-fake';
import { anItem } from '../../test/fixtures';
import { renderRoute } from '../../test/render';
import { addItemDraftStore } from './add-item-draft';

vi.mock('convex/react', () => import('../../test/convex-fake'));

vi.mock('./normalize-image', () => ({
  normalizeImage: (file: Blob) => Promise.resolve({ blob: file, width: 1200, height: 900 }),
}));

const PAGE = 'https://acme.test/p/coat';
const STORAGE_ID = 'storage_web' as Id<'_storage'>;

const CANDIDATES = [
  'https://cdn.acme.test/coat-front.jpg',
  'https://cdn.acme.test/coat-back.jpg',
  'https://cdn.acme.test/coat-detail.jpg',
];

let pageOutcomes: unknown[] = [];
let imageOutcomes: unknown[] = [];
let pageCalls: string[] = [];
let imageCalls: string[] = [];
let inserted: unknown[] = [];

const parsed = {
  status: 'ok',
  result: { candidates: CANDIDATES, sourceUrl: PAGE, name: 'Wool Overcoat', brand: 'Acme' },
};

const storedImage = {
  status: 'ok',
  storageId: STORAGE_ID,
  url: 'https://convex.test/f/stored.jpg',
  width: 1200,
  height: 900,
};

/** Both actions answer from a queue, so a test can drive a retry's second call. */
function stubBackend() {
  stubAction(api.webImport.importPage, async ({ url }) => {
    pageCalls.push(url);
    return (pageOutcomes.shift() ?? parsed) as never;
  });
  stubAction(api.webImport.importImage, async ({ url }) => {
    imageCalls.push(url);
    return (imageOutcomes.shift() ?? storedImage) as never;
  });
  stubMutation(api.items.generateUploadUrl, async () => 'https://upload.test/signed');
  stubMutation(api.items.create, async (args) => {
    inserted.push(args);
    return 'item_1' as Id<'items'>;
  });

  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ storageId: STORAGE_ID }),
  }));
}

/** The browser's Back button, which §5.8 makes an alias for the wizard's. */
const back = (router: ReturnType<typeof renderRoute>) =>
  act(async () => {
    await router.navigate(-1);
  });

async function fetchPage(user: ReturnType<typeof userEvent.setup>, url = PAGE) {
  await user.click(await screen.findByRole('link', { name: /import from web/i }));
  await user.type(await screen.findByLabelText(/product page/i), url);
  await user.click(screen.getByRole('button', { name: 'Fetch' }));
}

beforeEach(async () => {
  resetConvex();
  stubQuery(api.items.list, [anItem()]);
  pageOutcomes = [];
  imageOutcomes = [];
  pageCalls = [];
  imageCalls = [];
  inserted = [];
  await addItemDraftStore.drop();
});

afterEach(() => vi.unstubAllGlobals());

describe('pasting a product link', () => {
  it('walks paste → confirm image → review, pre-filled from the page', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');

    await fetchPage(user);

    expect(await screen.findByRole('img', { name: /found/i })).toHaveProperty(
      'src',
      CANDIDATES[0],
    );
    expect(router.state.location.pathname).toBe('/add/confirm-image');

    await user.click(screen.getByRole('button', { name: 'Use this image' }));

    expect(await screen.findByLabelText('Name')).toHaveProperty('value', 'Wool Overcoat');
    expect(router.state.location.pathname).toBe('/add/review');
    expect(screen.getByLabelText('Brand')).toHaveProperty('value', 'Acme');
    expect(screen.getByRole('link', { name: 'acme.test' })).toHaveProperty('href', PAGE);
  });

  it('saves the item against the stored image and the resolved source URL', async () => {
    const user = userEvent.setup();
    stubBackend();
    renderRoute('/add');
    await fetchPage(user);
    await user.click(await screen.findByRole('button', { name: 'Use this image' }));

    await user.click(await screen.findByRole('button', { name: 'Outerwear' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(inserted).toHaveLength(1));
    expect(inserted[0]).toEqual({
      image: STORAGE_ID,
      category: 'Outerwear',
      name: 'Wool Overcoat',
      brand: 'Acme',
      season: undefined,
      sourceUrl: PAGE,
    });
  });

  it('lights Fetch on http(s) syntax alone, never on a judgement about the page', async () => {
    const user = userEvent.setup();
    stubBackend();
    renderRoute('/add');
    await user.click(await screen.findByRole('link', { name: /import from web/i }));

    const field = await screen.findByLabelText(/product page/i);
    expect(screen.getByRole('button', { name: 'Fetch' })).toHaveProperty('disabled', true);

    await user.type(field, 'acme.test/p/coat');
    expect(screen.getByRole('button', { name: 'Fetch' })).toHaveProperty('disabled', true);

    await user.clear(field);
    // A bare homepage is as fetchable as a product page: the confirm step is the
    // validation, so no rule here may reject one.
    await user.type(field, 'https://acme.test/');
    expect(screen.getByRole('button', { name: 'Fetch' })).toHaveProperty('disabled', false);
  });

  it('never fetches while the socket is down, and says so', async () => {
    const user = userEvent.setup();
    stubBackend();
    setConnected(false);
    renderRoute('/add');

    await fetchPage(user);

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(pageCalls).toEqual([]);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });
});

describe('confirming which image', () => {
  it('offers the other images found, and imports the one swapped to', async () => {
    const user = userEvent.setup();
    stubBackend();
    renderRoute('/add');
    await fetchPage(user);

    await user.click(await screen.findByRole('button', { name: 'Image 3' }));
    expect(screen.getByRole('img', { name: /found/i })).toHaveProperty('src', CANDIDATES[2]);

    await user.click(screen.getByRole('button', { name: 'Use this image' }));

    await waitFor(() => expect(imageCalls).toEqual([CANDIDATES[2]]));
  });

  it('bails out to Review with a drop zone, still carrying the parse', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');
    await fetchPage(user);

    await user.click(await screen.findByRole('button', { name: /none of these/i }));

    expect(await screen.findByLabelText(/add your own image/i)).toBeDefined();
    expect(router.state.location.pathname).toBe('/add/review');
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Wool Overcoat');
    expect(imageCalls).toEqual([]);
  });

  it('empties the slot when the bail-out is reached back through a stored image', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');
    await fetchPage(user);
    await user.click(await screen.findByRole('button', { name: 'Use this image' }));
    await screen.findByRole('button', { name: 'Save' });

    await back(router);
    await user.click(await screen.findByRole('button', { name: /none of these/i }));

    expect(await screen.findByLabelText(/add your own image/i)).toBeDefined();
    expect(screen.queryByRole('img', { name: /picked/i })).toBeNull();
  });

  it('empties the slot when the download dead-ends after another was stored', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');
    await fetchPage(user);
    await user.click(await screen.findByRole('button', { name: 'Use this image' }));
    await screen.findByRole('button', { name: 'Save' });

    await back(router);
    imageOutcomes = [{ status: 'dead-end', message: "Couldn't use that image." }];
    await user.click(await screen.findByRole('button', { name: 'Image 2' }));
    await user.click(screen.getByRole('button', { name: 'Use this image' }));

    expect(await screen.findByLabelText(/add your own image/i)).toBeDefined();
    expect(screen.queryByRole('img', { name: /picked/i })).toBeNull();
  });

  it('bounces a deep link with no parse behind it', async () => {
    stubBackend();
    const router = renderRoute('/add/confirm-image');

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

/**
 * §5.4 — the two failure states split on the user's next action. The retryable
 * one keeps the field; the dead end walks on to Review carrying everything it
 * managed to read.
 */
describe('when the fetch fails', () => {
  it('offers Retry for a failure retrying can fix, and stays on the step', async () => {
    const user = userEvent.setup();
    stubBackend();
    pageOutcomes = [{ status: 'retryable', message: "Couldn't reach that page." }];
    const router = renderRoute('/add');

    await fetchPage(user);

    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't reach that page.");
    expect(router.state.location.pathname).toBe('/add/paste-link');

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await screen.findByRole('button', { name: 'Use this image' });
    expect(router.state.location.pathname).toBe('/add/confirm-image');
    expect(pageCalls).toEqual([PAGE, PAGE]);
  });

  it('falls through a dead end to Review, carrying URL, name and brand', async () => {
    const user = userEvent.setup();
    stubBackend();
    pageOutcomes = [
      {
        status: 'dead-end',
        message: "Couldn't get an image from that page.",
        sourceUrl: PAGE,
        name: 'Wool Overcoat',
        brand: 'Acme',
      },
    ];
    const router = renderRoute('/add');

    await fetchPage(user);

    expect(await screen.findByLabelText('Name')).toHaveProperty('value', 'Wool Overcoat');
    expect(router.state.location.pathname).toBe('/add/review');
    expect(screen.getByRole('link', { name: 'acme.test' })).toHaveProperty('href', PAGE);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('carries only the URL when there was no page to read', async () => {
    const user = userEvent.setup();
    stubBackend();
    pageOutcomes = [
      { status: 'dead-end', message: 'nope', sourceUrl: PAGE, name: null, brand: null },
    ];
    renderRoute('/add');

    await fetchPage(user);

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveProperty('value', ''));
    expect(screen.getByRole('link', { name: 'acme.test' })).toBeDefined();
  });

  it('keeps the image step usable when the download itself dead-ends', async () => {
    const user = userEvent.setup();
    stubBackend();
    imageOutcomes = [{ status: 'dead-end', message: "Couldn't use that image." }];
    const router = renderRoute('/add');
    await fetchPage(user);

    await user.click(await screen.findByRole('button', { name: 'Use this image' }));

    expect(await screen.findByLabelText(/add your own image/i)).toBeDefined();
    expect(router.state.location.pathname).toBe('/add/review');
  });

  it('retries a retryable download in place rather than walking on', async () => {
    const user = userEvent.setup();
    stubBackend();
    imageOutcomes = [{ status: 'retryable', message: "Couldn't reach that image." }];
    const router = renderRoute('/add');
    await fetchPage(user);

    await user.click(await screen.findByRole('button', { name: 'Use this image' }));

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(router.state.location.pathname).toBe('/add/confirm-image');
  });
});

/** §5.5 — the dead end is paste-or-drag-an-image, and nothing is thrown away. */
describe('the dead-end Review', () => {
  const deadEnd = {
    status: 'dead-end',
    message: "Couldn't get an image from that page.",
    sourceUrl: PAGE,
    name: 'Wool Overcoat',
    brand: 'Acme',
  };

  it('will not save without an image, however complete the fields are', async () => {
    const user = userEvent.setup();
    stubBackend();
    pageOutcomes = [deadEnd];
    renderRoute('/add');
    await fetchPage(user);

    await user.click(await screen.findByRole('button', { name: 'Top' }));

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
  });

  it('takes an image dropped into the slot and saves it with the carried source URL', async () => {
    const user = userEvent.setup();
    stubBackend();
    pageOutcomes = [deadEnd];
    renderRoute('/add');
    await fetchPage(user);

    await user.upload(
      await screen.findByLabelText(/add your own image/i),
      new File(['jpeg bytes'], 'coat.jpg', { type: 'image/jpeg' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Top' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(inserted).toHaveLength(1));
    expect(inserted[0]).toMatchObject({ image: STORAGE_ID, sourceUrl: PAGE });
  });
});

describe('the draft persists across the web-import walk', () => {
  it('empties the slot when a second paste dead-ends behind a stored image', async () => {
    const user = userEvent.setup();
    stubBackend();
    const router = renderRoute('/add');
    await fetchPage(user);
    await user.click(await screen.findByRole('button', { name: 'Use this image' }));
    await screen.findByRole('button', { name: 'Save' });

    await back(router);
    await back(router);
    pageOutcomes = [
      {
        status: 'dead-end',
        message: "Couldn't get an image from that page.",
        sourceUrl: 'https://other.test/p/hat',
        name: null,
        brand: null,
      },
    ];
    await user.type(await screen.findByLabelText(/product page/i), 'https://other.test/p/hat');
    await user.click(screen.getByRole('button', { name: 'Fetch' }));

    // The first page's image must not be offered under the second page's URL.
    expect(await screen.findByLabelText(/add your own image/i)).toBeDefined();
    expect(screen.getByRole('link', { name: 'other.test' })).toBeDefined();
  });

  it('drops a persisted draft whose image predates the tagged shape', async () => {
    stubBackend();
    await addItemDraftStore.write({
      image: { blob: new Blob(['jpeg']), width: 1200, height: 900 },
      storageId: null,
      imported: null,
    } as never);

    const router = renderRoute('/add/review');

    // Half-restoring it would render an empty slot behind an enabled Save.
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('resumes a cold load of the confirm step with the candidates still in hand', async () => {
    const user = userEvent.setup();
    stubBackend();
    renderRoute('/add');
    await fetchPage(user);
    await screen.findByRole('button', { name: 'Use this image' });

    cleanup();
    const router = renderRoute('/add/confirm-image');

    expect(await screen.findByRole('button', { name: 'Image 3' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/add/confirm-image');
  });
});
