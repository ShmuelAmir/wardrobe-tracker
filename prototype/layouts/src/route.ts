import { useEffect, useState } from 'react';

/**
 * PROTOTYPE routing — two search params, no router.
 *
 * `?variant=A|B|C` picks the thesis, `?screen=…` picks which of the four
 * load-bearing screens it's showing. #99 owns real routing; this is deliberately
 * the crudest thing that lets the switcher work and stay reload-stable.
 */

export const VARIANTS = ['A', 'B', 'C'] as const;
export type Variant = (typeof VARIANTS)[number];

export const VARIANT_NAMES: Record<Variant, string> = {
  A: 'Wider phone',
  B: 'Master–detail',
  C: 'Workbench',
};

export const SCREENS = ['wardrobe', 'item', 'builder', 'stats'] as const;
export type Screen = (typeof SCREENS)[number];

export const SCREEN_NAMES: Record<Screen, string> = {
  wardrobe: 'Wardrobe',
  item: 'Item detail',
  builder: 'Outfit builder',
  stats: 'Stats',
};

export type Route = { variant: Variant; screen: Screen };

const CHANGE = 'proto-route';

function read(): Route {
  const params = new URLSearchParams(window.location.search);
  const variant = params.get('variant') as Variant | null;
  const screen = params.get('screen') as Screen | null;
  return {
    variant: variant !== null && VARIANTS.includes(variant) ? variant : 'A',
    screen: screen !== null && SCREENS.includes(screen) ? screen : 'wardrobe',
  };
}

export function setRoute(next: Partial<Route>): void {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(next)) params.set(key, value);
  window.history.replaceState({}, '', `?${params.toString()}`);
  window.dispatchEvent(new Event(CHANGE));
}

export function useRoute(): Route {
  const [route, setState] = useState(read);
  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener('popstate', sync);
    window.addEventListener(CHANGE, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(CHANGE, sync);
    };
  }, []);
  return route;
}

/** system → light → dark, as one attribute on `<html>` (#95's finding 2). */
export function useScheme() {
  const [value, setValue] = useState<'system' | 'light' | 'dark'>('system');
  useEffect(() => {
    if (value === 'system') document.documentElement.removeAttribute('data-scheme');
    else document.documentElement.setAttribute('data-scheme', value);
  }, [value]);
  return {
    value,
    cycle: () =>
      setValue((c) => (c === 'system' ? 'light' : c === 'light' ? 'dark' : 'system')),
  };
}
