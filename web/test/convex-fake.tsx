import { getFunctionName, type FunctionReference } from 'convex/server';
import type { ReactNode } from 'react';

/**
 * The stand-in for `convex/react`, shaped to be used as
 * `vi.mock('convex/react', () => import('…/convex-fake'))`.
 *
 * Mocking at this seam is right on the merits and not only convenient: §3.6
 * establishes there is no client cache that can disagree with the server, so
 * `useQuery` *is* the boundary between the app and its data. It is also the only
 * option — `convex-test` has no React transport (§15.4).
 */

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

let authState: AuthState = 'authenticated';

// Keyed by `"items:list"` rather than by the reference itself: `api` is a proxy
// that mints a fresh object on every property access, so identity never matches.
const results = new Map<string, unknown>();

/** Call in `beforeEach`: signed in, with every query still in flight. */
export function resetConvex() {
  authState = 'authenticated';
  results.clear();
}

export function setAuthState(state: AuthState) {
  authState = state;
}

/** An unstubbed query stays `undefined`, which is what a first read looks like. */
export function stubQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  result: Query['_returnType'],
) {
  results.set(getFunctionName(query), result);
}

export function useQuery(query: FunctionReference<'query'>) {
  return results.get(getFunctionName(query));
}

export function AuthLoading({ children }: { children: ReactNode }) {
  return authState === 'loading' ? children : null;
}

export function Unauthenticated({ children }: { children: ReactNode }) {
  return authState === 'unauthenticated' ? children : null;
}

export function Authenticated({ children }: { children: ReactNode }) {
  return authState === 'authenticated' ? children : null;
}
