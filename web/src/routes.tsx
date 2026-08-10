import { Navigate, Outlet, type RouteObject } from 'react-router';

/**
 * The route tree — **stubbed, but real** (SPEC §7.1). Every surface below is a
 * placeholder the port fills in, but the *shape* is the shipped shape: one tree,
 * which both layouts render differently, with the desktop/phone fork made once
 * at the shell rather than by a second tree (ADR-0015).
 *
 * Two structural decisions are already load-bearing here and are the reason the
 * tree lands before any screen does:
 *
 *  - **Detail is a nested route, not a pushed one** (§7.2). `item/:id` is a
 *    *child* of the wardrobe layout, so the grid is rendered by the parent and
 *    never unmounts while the URL still names the selection. Both halves of
 *    "detail is a pane, and reload returns you to it" hold at once.
 *  - **Every wizard step is a real route** (§5.8), which is what makes browser
 *    Back into wizard Back for free.
 *
 * The two list layouts are **pathless** routes: they own the pane that stays
 * put, while their children own the pane that changes. That is what lets `/` and
 * `/item/:id` render the same grid without the grid appearing in two places.
 */

/** A placeholder surface. `Outlet` is what makes the nesting observable. */
function Surface({ name }: { name: string }) {
  return (
    <section data-surface={name}>
      <Outlet />
    </section>
  );
}

const surface = (name: string) => <Surface name={name} />;

export const routes: RouteObject[] = [
  {
    path: '/',
    element: surface('shell'),
    children: [
      {
        element: surface('wardrobe-grid'),
        children: [
          { index: true, element: surface('empty-item-pane') },
          {
            path: 'item/:id',
            element: surface('item-detail'),
            // A dialog at ≥900px, a full screen below it — a presentation
            // choice, so it stays one route either way.
            children: [{ path: 'edit', element: surface('item-edit') }],
          },
        ],
      },
      {
        element: surface('outfit-list'),
        children: [
          { path: 'outfits', element: surface('empty-outfit-pane') },
          { path: 'outfit/:id', element: surface('outfit-detail') },
        ],
      },
      // The sub-tabs are component state, not routes (§7.1).
      { path: 'stats', element: surface('stats') },
      {
        path: 'add',
        element: surface('add-item-wizard'),
        children: [
          { index: true, element: surface('add-source') },
          { path: 'paste-link', element: surface('add-paste-link') },
          { path: 'confirm-image', element: surface('add-confirm-image') },
          { path: 'confirm', element: surface('add-confirm') },
          { path: 'review', element: surface('add-review') },
          // Entered with `replace`, so Back never lands on a submitted form.
          { path: 'saved', element: surface('add-saved') },
        ],
      },
      {
        path: 'builder',
        element: surface('outfit-builder'),
        children: [
          { index: true, element: surface('builder-picker') },
          // Nested, so Back steps out of the category rather than out of the
          // builder.
          { path: 'category/:category', element: surface('builder-category') },
        ],
      },
      // One user and no inbound links, so an unknown path is a typo rather than
      // a broken promise: redirect, no designed 404 (§7.1).
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
