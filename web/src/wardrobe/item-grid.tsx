import type { Doc } from '@convex/_generated/dataModel';
import { useState } from 'react';

import './item-grid.css';

/**
 * The wardrobe grid (§4.1). Tiles are `object-fit: cover` and nothing else —
 * every other value disables the decode-time downscaling that stands in for the
 * thumbnails this app deliberately doesn't store (invariant #10).
 */
export function ItemGrid({ items }: { items: Doc<'items'>[] }) {
  return (
    <ul className="item-grid">
      {items.map((item) => (
        <li key={item._id}>
          <ItemTile item={item} />
          <p className="item-grid__label">{item.name ?? item.category}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * §4.5 — an image that cannot be rendered degrades to a category-shaped
 * placeholder rather than a broken tile. The row is not damaged when this
 * happens: row and file die together (§4.3), so what this covers is the weaker
 * row↔URL link — a stale `imageUrl`, or a file still uploading.
 */
function ItemTile({ item }: { item: Doc<'items'> }) {
  const [unrenderable, setUnrenderable] = useState(false);

  if (unrenderable) {
    return (
      <div className="item-grid__image item-grid__placeholder" role="img" aria-label={item.category}>
        <span className="item-grid__placeholder-label">{item.category}</span>
      </div>
    );
  }

  return (
    <img
      className="item-grid__image"
      src={item.imageUrl}
      alt={item.name ?? item.category}
      onError={() => setUnrenderable(true)}
    />
  );
}
