import { useAuthActions } from '@convex-dev/auth/react';
import { useState, type FormEvent } from 'react';

import './sign-in.css';

/**
 * The whole of §13's front end: an email and a password, for one human.
 *
 * There is no sign-up link — `signUp` exists on the server but is gated on a
 * secret and an empty user table (§13.4) — and **no forgot-password link**,
 * because recovery is an operator procedure in `docs/runbook.md` rather than a
 * screen (§13.6). Neither is an omission to be filled in later; a link here
 * would promise a path that does not exist.
 */
export function SignIn() {
  const { signIn } = useAuthActions();
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(false);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      await signIn('password', {
        email: form.get('email') as string,
        password: form.get('password') as string,
        flow: 'signIn',
      });
    } catch {
      // Which half was wrong is deliberately not said, and there is nothing to
      // retry *differently* — the password manager holds the credential.
      setFailed(true);
      setSubmitting(false);
    }
  }

  return (
    <main className="sign-in" data-surface="sign-in">
      <form className="sign-in__form" onSubmit={onSubmit}>
        <h1 className="sign-in__title">Wardrobe</h1>

        <label className="sign-in__field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="username" required />
        </label>

        <label className="sign-in__field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>

        {failed && (
          <p className="sign-in__error" role="alert">
            That email and password don’t match.
          </p>
        )}

        <button className="sign-in__submit" type="submit" disabled={submitting}>
          Sign in
        </button>
      </form>
    </main>
  );
}
