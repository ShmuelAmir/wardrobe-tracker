import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { Outlet } from 'react-router';

import { WardrobeHero } from './wardrobe-hero';

/**
 * The pane that stays put while `/item/:id` changes the one beside it (§7.2),
 * and the surface that decides between the wardrobe and its zero state.
 *
 * An empty wardrobe replaces **both** panes with the hero rather than leaving an
 * empty grid beside an empty detail (§7.7): there is nothing to select, so the
 * hero is full-bleed. The nav stays, because Outfits has its own gated zero
 * state to reach from here.
 */
export function WardrobeLayout() {
  const items = useQuery(api.items.list);

  // `undefined` is the first read still in flight — distinct from `[]`, which is
  // a genuinely empty wardrobe. Painting the hero for the former would flash it
  // at every reload of a full wardrobe.
  if (items === undefined) {
    return null;
  }

  if (items.length === 0) {
    return <WardrobeHero />;
  }

  return (
    <section data-surface="wardrobe-grid">
      <Outlet />
    </section>
  );
}
