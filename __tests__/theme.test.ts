import { getTheme, navigationTheme, type Theme } from '@/theme';

/**
 * The theme resolver is the highest seam in the design system (ADR-0013), tested
 * the way `wardrobe-view.ts` is — a pure module, called directly, no rendering.
 * The tests guard the two mistakes a role map invites: a role going missing from
 * the dark map, and a copy-paste leaving dark identical to light. They assert no
 * specific hex: a color's value is an implementation detail tuned on-device, so
 * pinning it here would be brittle.
 */

// The closed role set (9 single-color roles + `heroGradient`). A role added to
// the theme has to be added here too — that is the point of the completeness
// guard below.
const ROLES: (keyof Theme)[] = [
  'background',
  'surface',
  'border',
  'textPrimary',
  'textSecondary',
  'accent',
  'onAccent',
  'danger',
  'onDanger',
  'heroGradient',
];

describe('getTheme returns the complete closed role set', () => {
  it.each(['light', 'dark'] as const)('exposes every role in %s', (scheme) => {
    const theme = getTheme(scheme);

    for (const role of ROLES) {
      expect(theme[role]).toBeDefined();
    }
    // Exactly the closed set — no stray role, none missing.
    expect(Object.keys(theme).sort()).toEqual([...ROLES].sort());
  });

  it('resolves heroGradient to an ordered array of stops in both themes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(Array.isArray(getTheme(scheme).heroGradient)).toBe(true);
      expect(getTheme(scheme).heroGradient.length).toBeGreaterThan(1);
    }
  });
});

describe('light and dark differ on the load-bearing roles', () => {
  // Guards a copy-paste that leaves the dark map identical to light: if these
  // three are the same, dark mode is invisible where it matters most.
  it.each(['background', 'textPrimary', 'accent'] as const)('differs on %s', (role) => {
    expect(getTheme('light')[role]).not.toBe(getTheme('dark')[role]);
  });
});

describe('the navigation adapter maps roles onto RNs Theme', () => {
  it('sets the dark flag per scheme', () => {
    expect(navigationTheme('light').dark).toBe(false);
    expect(navigationTheme('dark').dark).toBe(true);
  });

  it.each(['light', 'dark'] as const)('maps our roles onto RNs slots in %s', (scheme) => {
    const theme = getTheme(scheme);
    const nav = navigationTheme(scheme);

    expect(nav.colors.primary).toBe(theme.accent);
    expect(nav.colors.background).toBe(theme.background);
    expect(nav.colors.card).toBe(theme.surface);
    expect(nav.colors.text).toBe(theme.textPrimary);
    expect(nav.colors.border).toBe(theme.border);
  });
});
