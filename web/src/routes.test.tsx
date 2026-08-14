import 'fake-indexeddb/auto';

import { api } from '@convex/_generated/api';
import { waitFor } from '@testing-library/react';

import { resetConvex, stubQuery } from '../test/convex-fake';
import { anItem } from '../test/fixtures';
import { renderRoute, surfaces } from '../test/render';
import { addItemDraftStore } from './add-item/add-item-draft';

vi.mock('convex/react', () => import('../test/convex-fake'));

/**
 * The URL space of §7.1, asserted as a table. It reads as bookkeeping until you
 * notice what each row's *chain* says: the surfaces are listed outermost-first,
 * so a row proves the nesting, not just that the URL resolves.
 *
 * `/item/:id` rendering `wardrobe-grid` above `item-detail` is §7.2 in one
 * assertion — the grid is the parent, so it never unmounts while the URL names
 * the selection. A future change that turns detail into a *pushed* route drops
 * `wardrobe-grid` from that chain and fails here.
 *
 * This is also the first thing `createMemoryRouter` buys that expo-router never
 * could: the router is mountable, so routing is testable at all (§15.4).
 */
async function surfacesAt(path: string, expected: string[]) {
  renderRoute(path);

  // The wizard's steps mount behind an asynchronous draft read, so a row is
  // asserted once the tree settles rather than on the first paint.
  await waitFor(() => expect(surfaces()).toEqual(expected));
}

beforeEach(async () => {
  resetConvex();
  // A wardrobe with something in it, so the rows below exercise the grid rather
  // than §7.7's zero state — which is a surface of its own, tested beside it.
  stubQuery(api.items.list, [anItem()]);
  // And a draft with both an image and a parse behind it, because the wizard's
  // middle steps are guarded: with nothing behind them they redirect (§5.8),
  // which the wizard's own tests assert.
  await addItemDraftStore.write({
    image: { kind: 'local', blob: new Blob(['jpeg']), width: 1200, height: 900 },
    storageId: null,
    imported: {
      sourceUrl: 'https://acme.test/p/coat',
      name: null,
      brand: null,
      candidates: ['https://cdn.acme.test/coat.jpg'],
      message: null,
    },
  });
});

describe('the route tree covers §7.1s URL space', () => {
  it.each([
    ['/', ['shell', 'wardrobe-grid', 'empty-item-pane']],
    ['/item/abc', ['shell', 'wardrobe-grid', 'item-detail']],
    ['/item/abc/edit', ['shell', 'wardrobe-grid', 'item-detail', 'item-edit']],
    ['/outfits', ['shell', 'outfit-list', 'empty-outfit-pane']],
    ['/outfit/abc', ['shell', 'outfit-list', 'outfit-detail']],
    ['/stats', ['shell', 'stats']],
    ['/add', ['shell', 'add-item-wizard', 'add-source']],
    ['/add/paste-link', ['shell', 'add-item-wizard', 'add-paste-link']],
    ['/add/confirm-image', ['shell', 'add-item-wizard', 'add-confirm-image']],
    ['/add/confirm', ['shell', 'add-item-wizard', 'add-confirm']],
    ['/add/review', ['shell', 'add-item-wizard', 'add-review']],
    ['/add/saved', ['shell', 'add-item-wizard', 'add-saved']],
    ['/builder', ['shell', 'outfit-builder', 'builder-picker']],
    ['/builder/category/tops', ['shell', 'outfit-builder', 'builder-category']],
  ])('renders %s as %j', async (path, expected) => {
    await surfacesAt(path, expected);
  });

  it('redirects an unknown path to the wardrobe rather than a 404', async () => {
    await surfacesAt('/nope/nowhere', ['shell', 'wardrobe-grid', 'empty-item-pane']);
  });
});
