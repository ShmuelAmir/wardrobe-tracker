import type { ReactNode } from 'react';

/**
 * Enough of `expo-router` for the ported domain tests to load the shipped theme
 * barrel — `resolve.ts` spreads one of the two base navigation themes and
 * `provider.tsx` renders the navigation provider.
 *
 * Coexistence-window scaffolding (see `vitest.config.ts`). expo-router is the
 * reason `theme.test.ts` does not port at all (§15.2), so this shim carries only
 * what the *other* ports touch; it is not an attempt to keep `navigationTheme`
 * alive.
 */
const base = {
  dark: false,
  colors: {
    primary: '',
    background: '',
    card: '',
    text: '',
    border: '',
    notification: '',
  },
  fonts: {},
};

export const DefaultTheme = base;
export const DarkTheme = { ...base, dark: true };
export const ThemeProvider = ({ children }: { children?: ReactNode }) => children;
