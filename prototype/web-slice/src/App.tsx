import { useQuery } from 'convex/react';
import { useEffect, useState } from 'react';

import { humanizeDaysAgo } from '@/relative-time';
import { parseWardrobeView, wardrobeChips, wardrobeTitle } from '@/wardrobe-view';

import { api } from '../../../convex/_generated/api';
import { ROLE_COUNT } from './theme/css-vars';

/**
 * PROTOTYPE — the whole vertical slice: Convex → grid → tokens, in one screen.
 *
 * The imports at the top are the finding. `wardrobe-view.ts` and
 * `relative-time.ts` are the **shipped** modules from `src/`, unmodified, doing
 * the same jobs they do on iOS: `parseWardrobeView` reads params that now come
 * from `URLSearchParams` instead of `useLocalSearchParams` and doesn't notice
 * the difference, because it was always typed against `string | string[] |
 * undefined`. That seam was drawn well.
 */
export function App() {
  const view = useWardrobeView();
  const items = useQuery(api.items.list, {});
  const scheme = useSchemeToggle();

  return (
    <div className="shell">
      <nav className="rail">
        <h1>Wardrobe</h1>
        <button aria-current="true">Wardrobe</button>
        <button aria-current="false">Outfits</button>
        <button aria-current="false">Stats</button>
        <button aria-current="false" onClick={scheme.cycle}>
          Theme: {scheme.value}
        </button>
      </nav>

      <main className="main">
        <section className="hero">
          <h2>{wardrobeTitle(view)}</h2>
          <p>
            {items === undefined
              ? 'Loading from Convex…'
              : `${items.length} items · ${ROLE_COUNT} semantic roles live as CSS variables`}
          </p>
        </section>

        <div className="chips">
          {wardrobeChips(view).map((chip) => (
            <button
              key={chip.key}
              className="chip"
              onClick={() => applyParams(chip.clearedParams)}
              title="Cleared by the shipped wardrobeChips() logic"
            >
              {chip.label} ✕
            </button>
          ))}
          <button className="chip" data-inert="true" onClick={() => applyParams({ sort: 'most', category: 'Footwear' })}>
            Try ?sort=most&category=Footwear
          </button>
        </div>

        {items === undefined ? (
          <div className="empty">Waiting for the first Convex read…</div>
        ) : items.length === 0 ? (
          <div className="empty">
            Nothing here yet. Run <code>npx convex run seed:wardrobe</code> from the repo root.
          </div>
        ) : (
          <div className="grid">
            {items.map((item) => (
              <button className="tile" key={item._id}>
                {item.imageUrl === null ? (
                  <div className="placeholder">{item.category}</div>
                ) : (
                  <img src={item.imageUrl} alt={item.name ?? item.category} loading="lazy" />
                )}
                <span className="label">{item.name ?? item.category}</span>
                <span className="meta">
                  {item.brand ?? item.category} ·{' '}
                  {humanizeDaysAgo(
                    Math.floor((Date.now() - item._creationTime) / 86_400_000),
                  ).toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="note">
          <strong>PROTOTYPE</strong> — throwaway slice for issue #95. Images come straight from{' '}
          <code>ctx.storage.getUrl()</code> with no cache headers, so every reload spends egress:
          that is exactly the gap #98 has to close.
        </p>
      </main>
    </div>
  );
}

/** URL params → the shipped `WardrobeView`, kept in sync with back/forward. */
function useWardrobeView() {
  const [search, setSearch] = useState(() => window.location.search);
  useEffect(() => {
    const onPop = () => setSearch(window.location.search);
    window.addEventListener('popstate', onPop);
    window.addEventListener('wardrobe-params', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('wardrobe-params', onPop);
    };
  }, []);
  return parseWardrobeView(Object.fromEntries(new URLSearchParams(search)));
}

/** `router.setParams` merges; `URLSearchParams` doesn't, so this does it here. */
function applyParams(next: { sort: string; category: string }) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(next)) {
    if (value === '') params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  window.history.pushState({}, '', query === '' ? window.location.pathname : `?${query}`);
  window.dispatchEvent(new Event('wardrobe-params'));
}

/** system → light → dark, written as one attribute on `<html>`. */
function useSchemeToggle() {
  const [value, setValue] = useState<'system' | 'light' | 'dark'>('system');
  useEffect(() => {
    if (value === 'system') document.documentElement.removeAttribute('data-scheme');
    else document.documentElement.setAttribute('data-scheme', value);
  }, [value]);
  return {
    value,
    cycle: () =>
      setValue((current) =>
        current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system',
      ),
  };
}
