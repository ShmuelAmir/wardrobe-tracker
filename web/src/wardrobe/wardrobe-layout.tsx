import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { Outlet, useLocation } from 'react-router';

import { WardrobeHero } from './wardrobe-hero';

/**
 * The pane that stays put while `/item/:id` changes the one beside it (§7.2),
 * and the surface that decides between the wardrobe and its zero state.
 *
 * An empty wardrobe replaces **both** panes with the hero rather than leaving an
 * empty grid beside an empty detail (§7.7): there is nothing to select, so the
 * hero is full-bleed. The nav stays, because Outfits has its own gated zero
 * state to reach from here.
 *
 * The hero is the whole of `/` and **only** `/`. A URL that names an item still
 * renders the panes even when the wardrobe is empty — that is exactly the state
 * where the other device has deleted the item, and §7.1 wants the pane to say
 * "this item is gone" rather than have the surface silently swapped underneath
 * it.
 */
export function WardrobeLayout() {
  const items = useQuery(api.items.list);
  const selectsAnItem = useLocation().pathname !== '/';

  // `undefined` is the first read still in flight — distinct from `[]`, which is
  // a genuinely empty wardrobe. Painting the hero for the former would flash it
  // at every reload of a full wardrobe.
  if (items === undefined) {
    return null;
  }

  if (items.length === 0 && !selectsAnItem) {
    return <WardrobeHero />;
  }

  return (
    <section data-surface="wardrobe-grid">
      <Outlet />
    </section>
  );
}
