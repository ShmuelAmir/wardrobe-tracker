import { NavLink } from 'react-router';

import './shell.css';

/**
 * The navigation chrome: **one component and one media query** (§7.4). The icon
 * rail at ≥900px and the bottom tabs below it are the same three destinations in
 * the same order — the fork is a CSS presentation choice, so a destination added
 * here cannot reach only one of the two layouts. Measuring the breakpoint in JS
 * would make the swap a client-side thing and give it a frame of the wrong
 * layout; the media query has already resolved before first paint.
 *
 * Destinations only. The shell's other two pieces of chrome — §7.5's contextual
 * `+` and §7.4's wear-again strip — arrive with the surfaces they open and read
 * from: the wizard, the builder, and the outfits the strip lists.
 */

const DESTINATIONS = [
  { to: '/', label: 'Wardrobe', glyph: 'M7 4 4 6v4h2v10h12V10h2V6l-3-2-2 2h-4Z' },
  { to: '/outfits', label: 'Outfits', glyph: 'M12 3 4 7v13h16V7Zm0 5 4 2v7H8v-7Z' },
  { to: '/stats', label: 'Stats', glyph: 'M5 20V10h3v10Zm5.5 0V4h3v16Zm5.5 0v-6h3v6Z' },
] as const;

export function AppNav() {
  return (
    <nav className="app-nav" aria-label="Main">
      {DESTINATIONS.map(({ to, label, glyph }) => (
        <NavLink
          key={to}
          to={to}
          // Only the wardrobe is a prefix of every other path, so it alone needs
          // the exact match to stop reading as current everywhere.
          end={to === '/'}
          className="app-nav__link"
        >
          <svg className="app-nav__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={glyph} />
          </svg>
          <span className="app-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
