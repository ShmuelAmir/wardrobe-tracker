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

// Same keying as the queries, and for the same reason.
const handlers = new Map<string, (args: never) => Promise<unknown>>();

// The socket the app reads its offline state off (§14.5). Connected by default,
// which is what every test that is not about being offline assumes.
let connected = true;

/** Call in `beforeEach`: signed in, online, with every query still in flight. */
export function resetConvex() {
  authState = 'authenticated';
  connected = true;
  results.clear();
  handlers.clear();
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

/**
 * A mutation's server behaviour, as a function of its arguments. Stubbing the
 * *behaviour* rather than a return value is what lets a test drive the paths a
 * flow has to survive — a first call that rejects and a second that succeeds is
 * how §4.4's retry is observable at all.
 */
export function stubMutation<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
  handler: (args: Mutation['_args']) => Promise<Mutation['_returnType']>,
) {
  handlers.set(getFunctionName(mutation), handler as (args: never) => Promise<unknown>);
}

export function useMutation<Mutation extends FunctionReference<'mutation'>>(mutation: Mutation) {
  return (args: Mutation['_args']) => {
    const handler = handlers.get(getFunctionName(mutation));
    if (handler === undefined) {
      throw new Error(`No stub for mutation ${getFunctionName(mutation)}`);
    }
    return handler(args as never) as Promise<Mutation['_returnType']>;
  };
}

/**
 * Actions share the mutations' registry: both are "call the server and await a
 * value", and a test that stubs one reads exactly like a test that stubs the
 * other. Keeping them apart would buy a distinction no caller here makes.
 */
export function stubAction<Action extends FunctionReference<'action'>>(
  action: Action,
  handler: (args: Action['_args']) => Promise<Action['_returnType']>,
) {
  handlers.set(getFunctionName(action), handler as (args: never) => Promise<unknown>);
}

export function useAction<Action extends FunctionReference<'action'>>(action: Action) {
  return (args: Action['_args']) => {
    const handler = handlers.get(getFunctionName(action));
    if (handler === undefined) {
      throw new Error(`No stub for action ${getFunctionName(action)}`);
    }
    return handler(args as never) as Promise<Action['_returnType']>;
  };
}

/** §14.5 — the offline signal, which is the socket and never `navigator.onLine`. */
export function setConnected(state: boolean) {
  connected = state;
}

export function useConvexConnectionState() {
  return { isWebSocketConnected: connected };
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
