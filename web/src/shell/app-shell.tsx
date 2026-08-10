import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react';
import { Outlet } from 'react-router';

import { AppNav } from './app-nav';
import { SignIn } from './sign-in';
import './shell.css';

/**
 * The root of §7's route tree, and the one place the app decides *which shell
 * state* is showing (§13.5). Sign-in is a state here rather than a route, which
 * is what keeps the attempted URL in the router's own location — the browser
 * stays on `/item/abc` while the form is up, and no `?next=` has to pollute
 * §7.1's URL space.
 *
 * The three states are listed in §13.5's order. The offline and install-teach
 * states arrive with the PWA work and go **ahead** of them — offline first,
 * because "not signed in" and "cannot reach Convex" look alike and `AuthLoading`
 * hangs forever when the backend is unreachable (§14.5).
 */
export function AppShell() {
  return (
    <>
      <AuthLoading>
        <div className="app-shell__loading" data-surface="auth-loading" />
      </AuthLoading>

      <Unauthenticated>
        <SignIn />
      </Unauthenticated>

      <Authenticated>
        <div className="app-shell" data-surface="shell">
          <AppNav />
          <main className="app-shell__panes">
            <Outlet />
          </main>
        </div>
      </Authenticated>
    </>
  );
}
