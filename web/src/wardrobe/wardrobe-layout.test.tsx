import { api } from '@convex/_generated/api';
import { screen } from '@testing-library/react';

import { resetConvex, stubQuery } from '../../test/convex-fake';
import { anItem } from '../../test/fixtures';
import { renderRoute } from '../../test/render';

vi.mock('convex/react', () => import('../../test/convex-fake'));

const wardrobe = (path = '/') => renderRoute(path);

beforeEach(resetConvex);

describe('the wardrobe zero state', () => {
  it('replaces both panes with the hero when there is nothing in the wardrobe', () => {
    stubQuery(api.items.list, []);

    wardrobe();

    expect(screen.getByRole('heading', { name: 'Your wardrobe starts here' })).toBeDefined();
    expect(document.querySelector('[data-surface="wardrobe-grid"]')).toBeNull();
  });

  it('leads its copy with the product-link path and offers the wizard', () => {
    stubQuery(api.items.list, []);

    wardrobe();

    const cta = screen.getByRole('link', { name: 'Add your first item' });

    expect(cta.getAttribute('href')).toBe('/add');
    expect(screen.getByText(/paste a product link/i)).toBeDefined();
  });

  it('keeps the nav, because the Outfits zero state is reached from here', () => {
    stubQuery(api.items.list, []);

    wardrobe();

    expect(screen.getByRole('navigation')).toBeDefined();
  });

  it('leaves a URL naming an item on the panes, so the pane can say it is gone', () => {
    stubQuery(api.items.list, []);

    wardrobe('/item/abc');

    expect(screen.queryByText('Your wardrobe starts here')).toBeNull();
    expect(document.querySelector('[data-surface="item-detail"]')).not.toBeNull();
  });

  it('shows the grid instead once an item exists', () => {
    stubQuery(api.items.list, [anItem({ name: 'linen shirt' })]);

    wardrobe();

    expect(document.querySelector('[data-surface="wardrobe-grid"]')).not.toBeNull();
    expect(screen.queryByText('Your wardrobe starts here')).toBeNull();
  });

  it('shows neither while the first read is still in flight', () => {
    wardrobe();

    expect(document.querySelector('[data-surface="wardrobe-grid"]')).toBeNull();
    expect(screen.queryByText('Your wardrobe starts here')).toBeNull();
  });
});
