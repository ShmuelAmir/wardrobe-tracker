import { Link } from 'react-router';

import './wardrobe-hero.css';

/**
 * The empty wardrobe, and the app's **only** hero (§7.7). There is no onboarding
 * flow, no tour and no cards — this screen is the onboarding, which is why the
 * body copy leads with the product-link path: §5 makes it the highest-quality
 * source, so the zero state is where to say so.
 */
export function WardrobeHero() {
  return (
    <section className="wardrobe-hero" data-surface="wardrobe-hero">
      <div className="wardrobe-hero__content">
        <p className="wardrobe-hero__glyph" aria-hidden="true">
          👕
        </p>
        <h1 className="wardrobe-hero__title">Your wardrobe starts here</h1>
        <p className="wardrobe-hero__body">
          Paste a product link and we’ll pull in the photo, brand and name for you — or drop in an
          image you already have.
        </p>
        <Link className="wardrobe-hero__cta" to="/add">
          Add your first item
        </Link>
      </div>
    </section>
  );
}
