import { useState } from 'react';

import { humanizeDaysAgo } from '@/relative-time';

import { coverOf, label, wearAgain, type WardrobeData } from '../data';
import { Thumb, daysSince } from '../thumb';
import type { Screen } from '../route';

/**
 * VARIANT A — "Wider phone".
 *
 * The thesis: there is **one** design. Desktop is the same screens in a wider
 * viewport, and all it buys is density — more grid columns, more rows above the
 * fold. The only structural change across the breakpoint is that the bottom tab
 * bar rotates into a left rail, because a bottom bar on a 27" monitor is absurd
 * and that's the one thing nobody will defend.
 *
 * Consequences it accepts, which are the interesting part to react to:
 *  - Every screen is a full-width route. Tapping an item *leaves* the grid.
 *  - The add-item wizard stays full-screen steps, exactly as on phone.
 *  - The wear-again rail survives on desktop unchanged, because nothing here
 *    treats desktop as a different mode of use.
 *
 * This is the cheapest variant to build and the cheapest to keep — one layout,
 * one set of components. Judge it on whether the desktop screens feel *empty*
 * rather than merely wide.
 */

const CATEGORIES = ['Top', 'Bottom', 'Outerwear', 'Footwear', 'Accessory', 'Bag'];

export function VariantA({ data, screen }: { data: WardrobeData; screen: Screen }) {
  return (
    <div className="a-shell">
      <nav className="a-nav">
        <h1 className="a-brand">Wardrobe</h1>
        <a className="a-nav-link" aria-current={screen === 'wardrobe' || screen === 'item'}>
          <span className="a-nav-glyph">▦</span> Wardrobe
        </a>
        <a className="a-nav-link" aria-current={screen === 'builder'}>
          <span className="a-nav-glyph">◫</span> Outfits
        </a>
        <a className="a-nav-link" aria-current={screen === 'stats'}>
          <span className="a-nav-glyph">▲</span> Stats
        </a>
        <div className="a-nav-spacer" />
        <button className="a-add">+ Add item</button>
      </nav>

      <main className="a-main">
        {screen === 'wardrobe' && <Wardrobe data={data} />}
        {screen === 'item' && <ItemDetail data={data} />}
        {screen === 'builder' && <Builder data={data} />}
        {screen === 'stats' && <Stats data={data} />}
      </main>
    </div>
  );
}

function Wardrobe({ data }: { data: WardrobeData }) {
  const rail = wearAgain(data.outfits);
  return (
    <div className="a-page">
      <header className="a-header">
        <h2>Your wardrobe</h2>
        <p>{data.items.length} items</p>
      </header>

      <section className="a-section">
        <h3 className="a-section-title">Wear again</h3>
        <div className="a-rail">
          {rail.map((outfit) => {
            const cover = coverOf(outfit, data.items);
            return (
              <article className="a-rail-card" key={outfit.id}>
                <Thumb item={cover} size={64} />
                <div className="a-rail-body">
                  <strong>{outfit.name}</strong>
                  <span className="a-muted">
                    {humanizeDaysAgo(daysSince(outfit.wearDates[0])).toLowerCase()}
                  </span>
                </div>
                <button className="a-ghost">Wore it</button>
              </article>
            );
          })}
        </div>
      </section>

      <div className="a-chips">
        {CATEGORIES.map((category) => (
          <button className="a-chip" key={category}>
            {category}
          </button>
        ))}
      </div>

      <div className="a-grid">
        {data.items.map((item) => (
          <button className="a-tile" key={item._id}>
            <Thumb item={item} />
            <span className="a-tile-name">{label(item)}</span>
            <span className="a-muted">{item.brand ?? item.category}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ItemDetail({ data }: { data: WardrobeData }) {
  const item = data.items[0];
  const wears = data.wearCounts.get(item._id) ?? 0;
  const inOutfits = data.outfits.filter((outfit) => outfit.itemIds.includes(item._id));
  return (
    <div className="a-page a-page-narrow">
      <button className="a-back">← Wardrobe</button>
      <div className="a-hero">
        <Thumb item={item} />
      </div>
      <h2 className="a-detail-title">{label(item)}</h2>

      <div className="a-strip">
        <div>
          <strong>{wears}</strong>
          <span className="a-muted">wears</span>
        </div>
        <div>
          <strong>{inOutfits.length}</strong>
          <span className="a-muted">outfits</span>
        </div>
        <div>
          <strong>{data.lastWorn.get(item._id) === null ? '—' : humanizeDaysAgo(daysSince(data.lastWorn.get(item._id)!))}</strong>
          <span className="a-muted">last worn</span>
        </div>
      </div>

      <dl className="a-fields">
        <div>
          <dt>Category</dt>
          <dd>{item.category}</dd>
        </div>
        <div>
          <dt>Brand</dt>
          <dd>{item.brand ?? '—'}</dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>—</dd>
        </div>
      </dl>

      <h3 className="a-section-title">In outfits</h3>
      <div className="a-rail">
        {inOutfits.map((outfit) => (
          <article className="a-rail-card" key={outfit.id}>
            <Thumb item={coverOf(outfit, data.items)} size={56} />
            <div className="a-rail-body">
              <strong>{outfit.name}</strong>
              <span className="a-muted">{outfit.wearDates.length} wears</span>
            </div>
          </article>
        ))}
      </div>

      <button className="a-edit">Edit</button>
    </div>
  );
}

function Builder({ data }: { data: WardrobeData }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <div className="a-page">
      <header className="a-header">
        <h2>New outfit</h2>
        <p>Tap to add. The sectioned checklist, straight off the phone.</p>
      </header>

      {CATEGORIES.map((category) => {
        const rows = data.items.filter((item) => item.category === category);
        if (rows.length === 0) return null;
        return (
          <section className="a-section" key={category}>
            <div className="a-section-head">
              <h3 className="a-section-title">{category}</h3>
              <button className="a-link">See all →</button>
            </div>
            <div className="a-rail">
              {rows.map((item) => (
                <button
                  className="a-pick"
                  key={item._id}
                  aria-pressed={picked.includes(item._id)}
                  onClick={() => toggle(item._id)}
                >
                  <Thumb item={item} size={96} />
                  <span className="a-muted">{label(item)}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <div className="a-sticky">
        <span>{picked.length} items</span>
        <input placeholder="Outfit name (optional)" />
        <button className="a-add" disabled={picked.length === 0}>
          Save
        </button>
      </div>
    </div>
  );
}

function Stats({ data }: { data: WardrobeData }) {
  const [tab, setTab] = useState<'least' | 'never'>('least');
  const worn = data.items
    .filter((item) => (data.wearCounts.get(item._id) ?? 0) > 0)
    .sort((a, b) => (data.wearCounts.get(b._id) ?? 0) - (data.wearCounts.get(a._id) ?? 0));
  const never = data.items.filter((item) => (data.wearCounts.get(item._id) ?? 0) === 0);
  const k = Math.min(5, Math.floor(worn.length / 2));
  const podium = worn.slice(0, 3);
  const least = worn.slice(-k).reverse();

  return (
    <div className="a-page a-page-narrow">
      <header className="a-header">
        <h2>Stats</h2>
      </header>

      <div className="a-chips">
        <button className="a-chip" aria-pressed="true">
          All
        </button>
        {CATEGORIES.map((category) => (
          <button className="a-chip" key={category}>
            {category}
          </button>
        ))}
      </div>

      <h3 className="a-section-title">Most worn</h3>
      <div className="a-podium">
        {podium.map((item, index) => (
          <div className={`a-podium-tile${index === 0 ? ' a-podium-first' : ''}`} key={item._id}>
            <Thumb item={item} />
            <span className="a-crown">{index === 0 ? 'Most worn' : `#${index + 1}`}</span>
            <span className="a-muted">{data.wearCounts.get(item._id)} wears</span>
          </div>
        ))}
      </div>

      <div className="a-subtabs">
        <button aria-pressed={tab === 'least'} onClick={() => setTab('least')}>
          Least worn
        </button>
        <button aria-pressed={tab === 'never'} onClick={() => setTab('never')}>
          Never worn
        </button>
      </div>

      <ul className="a-rows">
        {(tab === 'least' ? least : never).map((item) => (
          <li className="a-row" key={item._id}>
            <Thumb item={item} size={44} />
            <span className="a-row-name">{label(item)}</span>
            <span className={`a-badge${tab === 'never' ? ' a-badge-attention' : ''}`}>
              {data.wearCounts.get(item._id)} wears
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
