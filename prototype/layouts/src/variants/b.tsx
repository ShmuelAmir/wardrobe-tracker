import { useState } from 'react';

import { humanizeDaysAgo } from '@/relative-time';

import { coverOf, label, wearAgain, type WardrobeData } from '../data';
import type { Screen } from '../route';
import { Thumb, daysSince } from '../thumb';

/**
 * VARIANT B — "Master–detail".
 *
 * The thesis: on desktop the expensive thing is **losing your place**. A phone
 * pushes a detail screen because it has no room; a desktop doesn't, so the list
 * pane stays mounted and the right pane changes. Every screen becomes the same
 * two-pane shape, which means one interaction model to learn instead of four.
 *
 * Consequences it accepts:
 *  - Item detail never gets full width, so the hero image is small. That is the
 *    trade: context beats spectacle.
 *  - The add-item wizard becomes a **modal** over the grid — pushing a route
 *    would defeat the whole variant.
 *  - The builder's selection is permanently visible in the right pane, which
 *    is the strongest argument for this shape and the reason to try it.
 *  - The wear-again rail loses its home: there's no "Outfits tab you land on",
 *    so it becomes a strip pinned to the top of the list pane, always there.
 *
 * Below 900px both panes can't coexist: the list pane goes full-width and the
 * detail pane becomes a pushed route, i.e. it degrades exactly into A.
 */

const CATEGORIES = ['Top', 'Bottom', 'Outerwear', 'Footwear', 'Accessory', 'Bag'];

export function VariantB({ data, screen }: { data: WardrobeData; screen: Screen }) {
  return (
    <div className="b-shell">
      <nav className="b-nav">
        <h1 className="b-brand">W</h1>
        <button className="b-nav-icon" aria-current={screen === 'wardrobe' || screen === 'item'} title="Wardrobe">
          ▦
        </button>
        <button className="b-nav-icon" aria-current={screen === 'builder'} title="Outfits">
          ◫
        </button>
        <button className="b-nav-icon" aria-current={screen === 'stats'} title="Stats">
          ▲
        </button>
        <div className="b-nav-spacer" />
        <button className="b-nav-icon b-nav-add" title="Add item">
          +
        </button>
      </nav>

      {(screen === 'wardrobe' || screen === 'item') && <WardrobeSplit data={data} />}
      {screen === 'builder' && <BuilderSplit data={data} />}
      {screen === 'stats' && <StatsSplit data={data} />}
    </div>
  );
}

/**
 * Wardrobe and item detail are the *same screen* in this variant — that's the
 * whole point, so `?screen=item` just preselects a row.
 */
function WardrobeSplit({ data }: { data: WardrobeData }) {
  const [selected, setSelected] = useState<string>(data.items[0]._id);
  const item = data.items.find((row) => row._id === selected) ?? data.items[0];
  const inOutfits = data.outfits.filter((outfit) => outfit.itemIds.includes(item._id));
  const rail = wearAgain(data.outfits);

  return (
    <>
      <section className="b-list">
        <div className="b-strip">
          <span className="b-strip-label">Wear again</span>
          {rail.map((outfit) => (
            <button className="b-strip-card" key={outfit.id} title={`Log ${outfit.name} today`}>
              <Thumb item={coverOf(outfit, data.items)} size={32} />
              <span>{outfit.name}</span>
            </button>
          ))}
        </div>

        <div className="b-list-head">
          <h2>Wardrobe</h2>
          <span className="b-muted">{data.items.length} items</span>
        </div>

        <div className="b-chips">
          {CATEGORIES.map((category) => (
            <button className="b-chip" key={category}>
              {category}
            </button>
          ))}
        </div>

        <div className="b-grid">
          {data.items.map((row) => (
            <button
              className="b-tile"
              key={row._id}
              aria-pressed={row._id === selected}
              onClick={() => setSelected(row._id)}
            >
              <Thumb item={row} />
              <span className="b-tile-name">{label(row)}</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="b-detail">
        <div className="b-detail-hero">
          <Thumb item={item} />
        </div>
        <h2 className="b-detail-title">{label(item)}</h2>
        <p className="b-muted">{item.brand ?? item.category}</p>

        <div className="b-stats-strip">
          <div>
            <strong>{data.wearCounts.get(item._id) ?? 0}</strong>
            <span className="b-muted">wears</span>
          </div>
          <div>
            <strong>{inOutfits.length}</strong>
            <span className="b-muted">outfits</span>
          </div>
          <div>
            <strong>
              {data.lastWorn.get(item._id) == null
                ? '—'
                : humanizeDaysAgo(daysSince(data.lastWorn.get(item._id)!))}
            </strong>
            <span className="b-muted">last worn</span>
          </div>
        </div>

        <dl className="b-fields">
          <div>
            <dt>Category</dt>
            <dd>{item.category}</dd>
          </div>
          <div>
            <dt>Brand</dt>
            <dd>{item.brand ?? '—'}</dd>
          </div>
        </dl>

        <h3 className="b-sub">In outfits</h3>
        <ul className="b-mini-list">
          {inOutfits.map((outfit) => (
            <li key={outfit.id}>
              <Thumb item={coverOf(outfit, data.items)} size={36} />
              <span>{outfit.name}</span>
              <span className="b-muted">{outfit.wearDates.length} wears</span>
            </li>
          ))}
        </ul>

        <div className="b-detail-actions">
          <button className="b-primary">Edit</button>
        </div>
      </aside>
    </>
  );
}

function BuilderSplit({ data }: { data: WardrobeData }) {
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
      <section className="b-list">
        <div className="b-list-head">
          <h2>Pick items</h2>
          <span className="b-muted">{shown.length} shown</span>
        </div>
        <div className="b-chips">
          <button className="b-chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            All
          </button>
          {CATEGORIES.map((category) => (
            <button
              className="b-chip"
              key={category}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="b-grid">
          {shown.map((row) => (
            <button
              className="b-tile"
              key={row._id}
              aria-pressed={picked.includes(row._id)}
              onClick={() => toggle(row._id)}
            >
              <Thumb item={row} />
              <span className="b-tile-name">{label(row)}</span>
            </button>
          ))}
        </div>
      </section>

      <aside className="b-detail">
        <h2 className="b-detail-title">New outfit</h2>
        <p className="b-muted">{picked.length} items — visible the whole time you're picking.</p>

        <div className="b-chosen">
          {chosen.length === 0 ? (
            <div className="b-chosen-empty">Pick items on the left and they land here.</div>
          ) : (
            chosen.map((item) => (
              <button className="b-chosen-item" key={item._id} onClick={() => toggle(item._id)}>
                <Thumb item={item} />
                <span className="b-chosen-x">✕</span>
              </button>
            ))
          )}
        </div>

        <label className="b-field">
          <span>Name</span>
          <input placeholder="Optional" />
        </label>
        <label className="b-field">
          <span>Occasion</span>
          <input placeholder="work, shul, …" />
        </label>

        <div className="b-detail-actions">
          <button className="b-primary" disabled={picked.length === 0}>
            Save outfit
          </button>
        </div>
      </aside>
    </>
  );
}

function StatsSplit({ data }: { data: WardrobeData }) {
  const [tab, setTab] = useState<'most' | 'least' | 'never'>('most');
  const worn = data.items
    .filter((i) => (data.wearCounts.get(i._id) ?? 0) > 0)
    .sort((a, b) => (data.wearCounts.get(b._id) ?? 0) - (data.wearCounts.get(a._id) ?? 0));
  const never = data.items.filter((i) => (data.wearCounts.get(i._id) ?? 0) === 0);
  const k = Math.min(5, Math.floor(worn.length / 2));
  const rows = tab === 'most' ? worn.slice(0, k) : tab === 'least' ? worn.slice(-k).reverse() : never;
  const [selected, setSelected] = useState<string | null>(null);
  const item = data.items.find((i) => i._id === selected) ?? rows[0] ?? data.items[0];

  return (
    <>
      <section className="b-list">
        <div className="b-list-head">
          <h2>Stats</h2>
        </div>
        <div className="b-chips">
          <button className="b-chip" aria-pressed="true">
            All
          </button>
          {CATEGORIES.map((category) => (
            <button className="b-chip" key={category}>
              {category}
            </button>
          ))}
        </div>
        <div className="b-subtabs">
          {(['most', 'least', 'never'] as const).map((key) => (
            <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>
              {key === 'most' ? 'Most worn' : key === 'least' ? 'Least worn' : 'Never worn'}
            </button>
          ))}
        </div>
        <ul className="b-rank">
          {rows.map((row, index) => (
            <li key={row._id}>
              <button aria-pressed={row._id === item._id} onClick={() => setSelected(row._id)}>
                <span className="b-rank-n">{tab === 'never' ? '—' : index + 1}</span>
                <Thumb item={row} size={44} />
                <span className="b-rank-name">{label(row)}</span>
                <span className={`b-badge${tab === 'never' ? ' b-badge-attention' : ''}`}>
                  {data.wearCounts.get(row._id)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside className="b-detail">
        <div className="b-detail-hero">
          <Thumb item={item} />
        </div>
        <h2 className="b-detail-title">{label(item)}</h2>
        <p className="b-muted">
          {data.wearCounts.get(item._id)} wears ·{' '}
          {data.lastWorn.get(item._id) == null
            ? 'never worn'
            : humanizeDaysAgo(daysSince(data.lastWorn.get(item._id)!)).toLowerCase()}
        </p>
        <h3 className="b-sub">Worn in</h3>
        <ul className="b-mini-list">
          {data.outfits
            .filter((outfit) => outfit.itemIds.includes(item._id))
            .map((outfit) => (
              <li key={outfit.id}>
                <Thumb item={coverOf(outfit, data.items)} size={36} />
                <span>{outfit.name}</span>
                <span className="b-muted">{outfit.wearDates.length}</span>
              </li>
            ))}
        </ul>
        <p className="b-note">
          Selecting a row here inspects it without leaving the leaderboard — the thing the phone
          screen can't do.
        </p>
      </aside>
    </>
  );
}
