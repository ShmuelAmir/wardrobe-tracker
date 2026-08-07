import { useEffect } from 'react';

import {
  SCREENS,
  SCREEN_NAMES,
  VARIANTS,
  VARIANT_NAMES,
  setRoute,
  type Route,
} from './route';

/**
 * The floating switcher: variant on the left (← / → and arrow keys), the four
 * screens on the right. High-contrast on purpose — it must never read as part
 * of the design being judged.
 */
export function Switcher({ route, scheme }: { route: Route; scheme: { value: string; cycle: () => void } }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable]')) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const index = VARIANTS.indexOf(route.variant);
      setRoute({ variant: VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route.variant]);

  const cycle = (step: number) => {
    const index = VARIANTS.indexOf(route.variant);
    setRoute({ variant: VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length] });
  };

  return (
    <div className="switcher" role="group" aria-label="Prototype variant switcher">
      <button className="switcher-arrow" onClick={() => cycle(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className="switcher-label">
        <strong>{route.variant}</strong> — {VARIANT_NAMES[route.variant]}
      </span>
      <button className="switcher-arrow" onClick={() => cycle(1)} aria-label="Next variant">
        →
      </button>

      <span className="switcher-divider" />

      {SCREENS.map((screen) => (
        <button
          key={screen}
          className="switcher-screen"
          aria-pressed={screen === route.screen}
          onClick={() => setRoute({ screen })}
        >
          {SCREEN_NAMES[screen]}
        </button>
      ))}

      <span className="switcher-divider" />

      <button className="switcher-screen" onClick={scheme.cycle}>
        {scheme.value}
      </button>
    </div>
  );
}
