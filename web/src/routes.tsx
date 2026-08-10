import { Navigate, Outlet, type RouteObject } from 'react-router';

import { AppShell } from './shell/app-shell';
import { WardrobeLayout } from './wardrobe/wardrobe-layout';

/**
 * §7.1's URL space as one tree, with most surfaces still placeholders. The
 * nesting is the part that is already load-bearing: the two list layouts are
 * **pathless** routes owning the pane that stays put, while their children own
 * the pane that changes, so `/` and `/item/:id` render the same grid without it
 * appearing in two places — detail is a nested route, not a pushed one (§7.2).
 *
 * The whole tree hangs off `<AppShell>`, which renders its children only when
 * signed in — that is what makes login a shell state rather than a route
 * (§13.5), including for the `*` redirect below.
 */

/** A placeholder surface. `Outlet` is what makes the nesting observable. */
function Surface({ name }: { name: string }) {
  return (
    <section data-surface={name}>
      <Outlet />
    </section>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        element: <WardrobeLayout />,
        children: [
          { index: true, element: <Surface name="empty-item-pane" /> },
          {
            path: 'item/:id',
            element: <Surface name="item-detail" />,
            // A dialog at ≥900px, a full screen below it — a presentation
            // choice, so it stays one route either way.
            children: [{ path: 'edit', element: <Surface name="item-edit" /> }],
          },
        ],
      },
      {
        element: <Surface name="outfit-list" />,
        children: [
          { path: 'outfits', element: <Surface name="empty-outfit-pane" /> },
          { path: 'outfit/:id', element: <Surface name="outfit-detail" /> },
        ],
      },
      // The sub-tabs are component state, not routes (§7.1).
      { path: 'stats', element: <Surface name="stats" /> },
      {
        path: 'add',
        element: <Surface name="add-item-wizard" />,
        children: [
          { index: true, element: <Surface name="add-source" /> },
          { path: 'paste-link', element: <Surface name="add-paste-link" /> },
          { path: 'confirm-image', element: <Surface name="add-confirm-image" /> },
          { path: 'confirm', element: <Surface name="add-confirm" /> },
          { path: 'review', element: <Surface name="add-review" /> },
          // Entered with `replace`, so Back never lands on a submitted form.
          { path: 'saved', element: <Surface name="add-saved" /> },
        ],
      },
      {
        path: 'builder',
        element: <Surface name="outfit-builder" />,
        children: [
          { index: true, element: <Surface name="builder-picker" /> },
          // Nested, so Back steps out of the category rather than out of the
          // builder.
          { path: 'category/:category', element: <Surface name="builder-category" /> },
        ],
      },
      // One user and no inbound links, so an unknown path is a typo rather than
      // a broken promise: redirect, no designed 404 (§7.1).
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
