import { api } from '@convex/_generated/api';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { resetConvex, stubQuery } from '../../test/convex-fake';
import { anItem } from '../../test/fixtures';
import { routes } from '../routes';

vi.mock('convex/react', () => import('../../test/convex-fake'));

function wardrobe() {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);
}

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
