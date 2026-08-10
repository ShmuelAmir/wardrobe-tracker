import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../src/routes';

/**
 * Mounts the real route tree at a URL and hands back the router, so a test can
 * assert on the location as well as the DOM.
 *
 * The caller still writes its own `vi.mock('convex/react', …)` — that call is
 * hoisted above every import, so it cannot live in here.
 */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

/** The `data-surface` chain at the current location, outermost first. */
export function surfaces(): string[] {
  return [...document.querySelectorAll('[data-surface]')].map(
    (element) => element.getAttribute('data-surface') as string,
  );
}
