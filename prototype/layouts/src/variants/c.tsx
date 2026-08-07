import { useState } from 'react';

import { humanizeDaysAgo } from '@/relative-time';

import { coverOf, label, wearAgain, type WardrobeData } from '../data';
import type { Screen } from '../route';
import { Thumb, daysSince } from '../thumb';

/**
 * VARIANT C — "Workbench".
 *
 * The thesis: the app's *point* is assembling outfits, and a desktop is the
 * first surface with room to do that properly. So the builder stops being one
 * screen among four and becomes the shape everything else borrows: a stage on
 * top, a persistent wardrobe tray along the bottom, always in reach.
 *
 * Consequences it accepts:
 *  - Nav goes to a **top bar**, because the tray owns the bottom edge and a
 *    left rail would fight the full-bleed stage.
 *  - Stats stops being sub-tabs and becomes a **dashboard** — most-worn,
 *    least-worn and never-worn visible at once. On a phone you can only afford
 *    one list; on desktop making the user toggle is a phone habit.
 *  - Item detail is an **overlay** over the gallery, so the tray survives.
 *  - The wear-again rail is promoted into a permanent "today" strip in the top
 *    bar — logging is the only daily act (map #1, #13), so it gets chrome.
 *  - The add-item wizard becomes an inline tray step, not a route or a modal.
 *
 * This is the most expensive variant to build and the one most likely to be
 * over-designed for a wardrobe of 40 items. Judge it on whether the tray earns
 * the vertical space it permanently costs.
 */

const CATEGORIES = ['Top', 'Bottom', 'Outerwear', 'Footwear', 'Accessory', 'Bag'];

export function VariantC({ data, screen }: { data: WardrobeData; screen: Screen }) {
  const rail = wearAgain(data.outfits);
  return (
    <div className="c-shell">
      <header className="c-top">
        <h1 className="c-brand">Wardrobe</h1>
        <nav className="c-tabs">
          <button aria-current={screen === 'wardrobe' || screen === 'item'}>Wardrobe</button>
          <button aria-current={screen === 'builder'}>Build</button>
          <button aria-current={screen === 'stats'}>Stats</button>
        </nav>
        <div className="c-today">
          <span className="c-today-label">Today</span>
          {rail.slice(0, 3).map((outfit) => (
            <button className="c-today-chip" key={outfit.id} title={`Log ${outfit.name}`}>
              <Thumb item={coverOf(outfit, data.items)} size={24} />
              {outfit.name}
            </button>
          ))}
        </div>
        <button className="c-add">+ Add</button>
      </header>

      {(screen === 'wardrobe' || screen === 'item') && (
        <Gallery data={data} overlay={screen === 'item'} />
      )}
      {screen === 'builder' && <Workbench data={data} />}
      {screen === 'stats' && <Dashboard data={data} />}
    </div>
  );
}

function Gallery({ data, overlay }: { data: WardrobeData; overlay: boolean }) {
  const [open, setOpen] = useState<string | null>(overlay ? data.items[0]._id : null);
  const item = data.items.find((i) => i._id === open);
  const inOutfits = item ? data.outfits.filter((o) => o.itemIds.includes(item._id)) : [];

  return (
    <>
      <main className="c-stage">
        <div className="c-filter-bar">
          {['All', ...CATEGORIES].map((category) => (
            <button className="c-filter" key={category} aria-pressed={category === 'All'}>
              {category}
            </button>
          ))}
          <span className="c-count">{data.items.length} items</span>
        </div>

        <div className="c-gallery">
          {data.items.map((row) => (
            <button className="c-cell" key={row._id} onClick={() => setOpen(row._id)}>
              <Thumb item={row} />
              <span className="c-cell-hover">
                <strong>{label(row)}</strong>
                <span>{data.wearCounts.get(row._id)} wears</span>
                <span className="c-cell-actions">
                  <span className="c-mini">Add to outfit</span>
                  <span className="c-mini">Edit</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </main>

      {item !== undefined && (
        <div className="c-overlay" role="dialog" aria-label={label(item)}>
          <div className="c-overlay-card">
            <button className="c-overlay-close" onClick={() => setOpen(null)}>
              ✕
            </button>
            <div className="c-overlay-image">
              <Thumb item={item} />
            </div>
            <div className="c-overlay-body">
              <h2>{label(item)}</h2>
              <p className="c-muted">{item.brand ?? item.category}</p>
              <div className="c-strip">
                <div>
                  <strong>{data.wearCounts.get(item._id)}</strong>
                  <span className="c-muted">wears</span>
                </div>
                <div>
                  <strong>{inOutfits.length}</strong>
                  <span className="c-muted">outfits</span>
                </div>
                <div>
                  <strong>
                    {data.lastWorn.get(item._id) == null
                      ? '—'
                      : humanizeDaysAgo(daysSince(data.lastWorn.get(item._id)!))}
                  </strong>
                  <span className="c-muted">last worn</span>
                </div>
              </div>
              <ul className="c-mini-list">
                {inOutfits.map((outfit) => (
                  <li key={outfit.id}>
                    <Thumb item={coverOf(outfit, data.items)} size={32} />
                    <span>{outfit.name}</span>
                  </li>
                ))}
              </ul>
              <div className="c-overlay-actions">
                <button className="c-primary">Edit</button>
                <button className="c-ghost">Add to outfit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Workbench({ data }: { data: WardrobeData }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const toggle = (id: string) =>
    setPicked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const shown = filter === null ? data.items : data.items.filter((i) => i.category === filter);
  const chosen = picked
    .map((id) => data.items.find((i) => i._id === id))
    .filter((i): i is NonNullable<typeof i> => i !== undefined);

  return (
    <>
      <main className="c-stage c-stage-canvas">
        <div className="c-canvas-head">
          <input className="c-canvas-name" placeholder="Untitled outfit" />
          <input className="c-canvas-occasion" placeholder="occasion" />
          <span className="c-count">{picked.length} items</span>
          <button className="c-primary" disabled={picked.length === 0}>
            Save
          </button>
        </div>

        <div className={`c-canvas${chosen.length === 0 ? ' c-canvas-empty' : ''}`}>
          {chosen.length === 0 ? (
            <p>Click anything in the tray below. It lands here, at size.</p>
          ) : (
            chosen.map((item) => (
              <figure className="c-canvas-item" key={item._id}>
                <Thumb item={item} />
                <figcaption>{label(item)}</figcaption>
                <button className="c-canvas-remove" onClick={() => toggle(item._id)}>
                  ✕
                </button>
              </figure>
            ))
          )}
        </div>
      </main>

      <footer className="c-tray">
        <div className="c-tray-filters">
          <button aria-pressed={filter === null} onClick={() => setFilter(null)}>
            All
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="c-tray-rail">
          {shown.map((item) => (
            <button
              className="c-tray-item"
              key={item._id}
              aria-pressed={picked.includes(item._id)}
              onClick={() => toggle(item._id)}
            >
              <Thumb item={item} size={72} />
            </button>
          ))}
        </div>
      </footer>
    </>
  );
}

function Dashboard({ data }: { data: WardrobeData }) {
  const worn = data.items
    .filter((i) => (data.wearCounts.get(i._id) ?? 0) > 0)
    .sort((a, b) => (data.wearCounts.get(b._id) ?? 0) - (data.wearCounts.get(a._id) ?? 0));
  const never = data.items.filter((i) => (data.wearCounts.get(i._id) ?? 0) === 0);
  const k = Math.min(5, Math.floor(worn.length / 2));
  const most = worn.slice(0, k);
  const least = worn.slice(-k).reverse();
  const byCategory = CATEGORIES.map((category) => ({
    category,
    wears: data.items
      .filter((i) => i.category === category)
      .reduce((sum, i) => sum + (data.wearCounts.get(i._id) ?? 0), 0),
  }));
  const peak = Math.max(1, ...byCategory.map((row) => row.wears));

  return (
    <main className="c-stage">
      <div className="c-filter-bar">
        {['All', ...CATEGORIES].map((category) => (
          <button className="c-filter" key={category} aria-pressed={category === 'All'}>
            {category}
          </button>
        ))}
      </div>

      <div className="c-dash">
        <section className="c-card c-card-wide">
          <h3>Most worn</h3>
          <div className="c-podium">
            {most.slice(0, 3).map((item, index) => (
              <div className={`c-podium-tile${index === 0 ? ' c-podium-first' : ''}`} key={item._id}>
                <Thumb item={item} />
                <strong>{label(item)}</strong>
                <span className="c-muted">{data.wearCounts.get(item._id)} wears</span>
              </div>
            ))}
          </div>
        </section>

        <section className="c-card">
          <h3>Least worn</h3>
          <ul className="c-rows">
            {least.map((item) => (
              <li key={item._id}>
                <Thumb item={item} size={36} />
                <span>{label(item)}</span>
                <span className="c-badge">{data.wearCounts.get(item._id)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="c-card">
          <h3>Never worn ({never.length})</h3>
          <ul className="c-rows">
            {never.slice(0, 6).map((item) => (
              <li key={item._id}>
                <Thumb item={item} size={36} />
                <span>{label(item)}</span>
                <span className="c-badge c-badge-attention">0</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="c-card">
          <h3>Wears by category</h3>
          <ul className="c-bars">
            {byCategory.map((row) => (
              <li key={row.category}>
                <span className="c-bar-label">{row.category}</span>
                <span className="c-bar-track">
                  <span className="c-bar-fill" style={{ width: `${(row.wears / peak) * 100}%` }} />
                </span>
                <span className="c-muted">{row.wears}</span>
              </li>
            ))}
          </ul>
          <p className="c-note">
            Map #1 ruled this out as a metric — it's a filter, not a roll-up. Drawn here on
            purpose: a dashboard invites tiles that the phone screen was right to refuse.
          </p>
        </section>
      </div>
    </main>
  );
}
