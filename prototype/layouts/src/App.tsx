import { useWardrobeData } from './data';
import { useRoute, useScheme } from './route';
import { Switcher } from './switcher';
import { VariantA } from './variants/a';
import { VariantB } from './variants/b';
import { VariantC } from './variants/c';

/**
 * PROTOTYPE for issue #96 — three variants of the responsive layout, switchable
 * via `?variant=`, each rendering all four load-bearing screens via `?screen=`.
 *
 * The variants deliberately do **not** share a layout component. Each one is a
 * different answer to "what is desktop for", and a shared shell would smuggle
 * one of those answers into all three:
 *
 *   A — Wider phone.    One design at two widths; desktop buys density.
 *   B — Master–detail.  Desktop is about never losing your place.
 *   C — Workbench.      Desktop shows several things at once.
 *
 * All three collapse to a phone layout below 900px, and the phone layouts are
 * meant to be judged too — a thesis that only works at 1440px has failed.
 */
export function App() {
  const route = useRoute();
  const data = useWardrobeData();
  const scheme = useScheme();

  if (data.loading) {
    return (
      <>
        <div className="boot">Reading the wardrobe from Convex…</div>
        <Switcher route={route} scheme={scheme} />
      </>
    );
  }

  if (data.items.length === 0) {
    return (
      <>
        <div className="boot">
          No items. Run <code>npx convex run seed:wardrobe</code> from the repo root.
        </div>
        <Switcher route={route} scheme={scheme} />
      </>
    );
  }

  return (
    <>
      {route.variant === 'A' && <VariantA data={data} screen={route.screen} />}
      {route.variant === 'B' && <VariantB data={data} screen={route.screen} />}
      {route.variant === 'C' && <VariantC data={data} screen={route.screen} />}
      <Switcher route={route} scheme={scheme} />
    </>
  );
}
