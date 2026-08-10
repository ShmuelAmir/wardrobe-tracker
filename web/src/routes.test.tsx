import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from './routes';

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
function surfacesAt(path: string): string[] {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const { container } = render(<RouterProvider router={router} />);

  return [...container.querySelectorAll('[data-surface]')].map(
    (element) => element.getAttribute('data-surface') as string,
  );
}

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
  ])('renders %s as %j', (path, expected) => {
    expect(surfacesAt(path)).toEqual(expected);
  });

  it('redirects an unknown path to the wardrobe rather than a 404', () => {
    expect(surfacesAt('/nope/nowhere')).toEqual(['shell', 'wardrobe-grid', 'empty-item-pane']);
  });
});
