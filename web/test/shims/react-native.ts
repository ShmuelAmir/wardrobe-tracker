/**
 * Enough of `react-native` for the ported domain tests to load the shipped
 * theme barrel — `provider.tsx` reads the appearance once, and `tokens.ts`
 * imports `TextStyle` as a type, which erases.
 *
 * Coexistence-window scaffolding (see `vitest.config.ts`): it exists so
 * `contrast.test.ts` can port byte-identical while the native app is still on
 * disk, and is deleted with the expo dependencies at cutover.
 */
export const useColorScheme = (): 'light' | 'dark' | null => 'light';
