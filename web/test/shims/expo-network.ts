/**
 * Enough of `expo-network` for `web-import-gallery.test.ts` to reach `parsePage`.
 * The parser is pure; only its module's reachability check is not, and the
 * gallery test never calls it.
 *
 * Coexistence-window scaffolding (see `vitest.config.ts`). It dies with the
 * fetch half of `src/web-import.ts`, which becomes a server-side Convex action
 * (§5.3) where reachability is the server's problem rather than the device's.
 */
export const getNetworkStateAsync = async () => ({
  isConnected: true,
  isInternetReachable: true,
});
