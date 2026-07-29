/**
 * The theme subsystem's public surface. Everything a component may touch is
 * re-exported here; `primitives.ts` is deliberately *not*, so raw hex cannot
 * leak back into a component through this barrel.
 */
export { ThemeProvider, useTheme } from './provider';
export { getTheme, navigationTheme, type ColorScheme } from './resolve';
export type { Theme } from './light';
export { spacing, radii, type, type TextVariant } from './tokens';
