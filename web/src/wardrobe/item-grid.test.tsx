import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { fireEvent, screen } from '@testing-library/react';

import { resetConvex, stubQuery } from '../../test/convex-fake';
import { anItem } from '../../test/fixtures';
import { renderRoute } from '../../test/render';

vi.mock('convex/react', () => import('../../test/convex-fake'));

beforeEach(resetConvex);

describe('the wardrobe grid', () => {
  it('renders a tile per item, newest first as the query returns them', () => {
    stubQuery(api.items.list, [
      anItem({ _id: 'a' as Id<'items'>, name: 'linen shirt' }),
      anItem({ _id: 'b' as Id<'items'>, name: 'wool coat' }),
    ]);

    renderRoute('/');

    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
      'linen shirt',
      'wool coat',
    ]);
  });

  it('covers the tile, which is what keeps decode-time downscaling', () => {
    stubQuery(api.items.list, [anItem()]);

    renderRoute('/');

    // Asserted off the class rather than a computed style: jsdom applies no
    // stylesheet, and the class is the contract the CSS hangs `cover` on.
    expect(screen.getByRole('img').className).toContain('item-grid__image');
  });

  it('falls back to the category placeholder when the image will not render', () => {
    stubQuery(api.items.list, [anItem({ category: 'Footwear', name: 'boots' })]);

    renderRoute('/');
    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByRole('img', { name: 'Footwear' })).toBeDefined();
    expect(screen.queryByRole('img', { name: 'boots' })).toBeNull();
  });

  it('captions an unnamed item with its category', () => {
    stubQuery(api.items.list, [anItem({ category: 'Bag' })]);

    renderRoute('/');

    expect(screen.getByText('Bag')).toBeDefined();
  });

  it('offers the wizard from the grid’s own + affordance', () => {
    stubQuery(api.items.list, [anItem()]);

    renderRoute('/');

    expect(screen.getByRole('link', { name: 'Add an item' }).getAttribute('href')).toBe('/add');
  });
});
