import { api } from '@convex/_generated/api';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetConvex, setAuthState, stubQuery } from '../../test/convex-fake';
import { anItem } from '../../test/fixtures';
import { renderRoute } from '../../test/render';

vi.mock('convex/react', () => import('../../test/convex-fake'));

const signIn = vi.fn();
vi.mock('@convex-dev/auth/react', () => ({ useAuthActions: () => ({ signIn }) }));

beforeEach(() => {
  resetConvex();
  signIn.mockReset();
  stubQuery(api.items.list, [anItem()]);
});

describe('login is a shell state, not a route', () => {
  it('puts the sign-in form over the URL that was asked for, leaving it intact', async () => {
    setAuthState('unauthenticated');

    const router = renderRoute('/item/abc');

    expect(screen.getByLabelText('Password')).toBeDefined();
    // Not `/sign-in`, and no `?next=` — the attempted location is simply still
    // the location (§13.5), so signing in reveals what was asked for.
    expect(router.state.location.pathname).toBe('/item/abc');
    expect(router.state.location.search).toBe('');
  });

  it('shows neither the app nor the form while auth is still resolving', () => {
    setAuthState('loading');

    renderRoute('/');

    expect(document.querySelector('[data-surface="auth-loading"]')).not.toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('offers no way to sign up and no way to recover a password', () => {
    setAuthState('unauthenticated');

    renderRoute('/');

    expect(screen.queryByText(/sign up|create account/i)).toBeNull();
    expect(screen.queryByText(/forgot/i)).toBeNull();
  });

  it('signs in with the password flow', async () => {
    setAuthState('unauthenticated');
    renderRoute('/');

    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'a-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(signIn).toHaveBeenCalledWith('password', {
      email: 'owner@example.test',
      password: 'a-long-enough-password',
      flow: 'signIn',
    });
  });

  it('says a rejected credential is rejected, without saying which half', async () => {
    signIn.mockRejectedValue(new Error('InvalidAccountId'));
    setAuthState('unauthenticated');
    renderRoute('/');

    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('alert').textContent).toBe('That email and password don’t match.');
  });
});

describe('the navigation chrome', () => {
  it('renders the same three destinations from one nav', () => {
    renderRoute('/');

    const links = screen.getAllByRole('link');

    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/outfits', '/stats']);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('marks only the current destination', () => {
    renderRoute('/stats');

    expect(screen.getByRole('link', { current: 'page' }).textContent).toBe('Stats');
  });
});
