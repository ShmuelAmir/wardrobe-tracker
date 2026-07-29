import { ThemeProvider as NavThemeProvider } from 'expo-router';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { light, type Theme } from './light';
import { getTheme, navigationTheme } from './resolve';

const ThemeContext = createContext<Theme>(light);

/**
 * The single source of the active theme for *both* content and navigation
 * chrome (ADR-0013). It reads `useColorScheme()` once and drives two consumers
 * from that one read: our own context (screen bodies, via `useTheme()`) and the
 * React Navigation adapter (native headers, tab bar, modal backgrounds). One
 * appearance read means the chrome can never disagree with the content about
 * whether it is light or dark.
 *
 * Mounted once, above the router, in the root `_layout.tsx`. `StatusBar` stays
 * `style="auto"` — it reads the system directly and needs no wiring here.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Anything the system reports that isn't an explicit dark preference falls to
  // light — `null`/`undefined`/`'unspecified'` all mean "no dark request".
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = useMemo(() => getTheme(scheme), [scheme]);
  const navTheme = useMemo(() => navigationTheme(scheme), [scheme]);

  return (
    <ThemeContext.Provider value={theme}>
      <NavThemeProvider value={navTheme}>{children}</NavThemeProvider>
    </ThemeContext.Provider>
  );
}

/** Read the active theme's role map. The only way a component sees a color. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
