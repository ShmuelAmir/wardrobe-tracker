import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

/**
 * SPEC.md §13 — Convex Auth in password mode, for exactly one human.
 *
 * There is no `convex/http.ts` and that is deliberate: `/api/auth/*` serves
 * only OAuth redirects and magic links, both of which §13.1 rules out, and
 * password sign-in is an ordinary function call. Registering no root HTTP
 * routes is what lets §14.1 mount static hosting at `/`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      /**
       * Called on every flow, so the gate names the one it guards. The other
       * half of §13.4's pair — that no user exists yet — is in
       * `createOrUpdateUser` below, which is the only callback with a database
       * to ask.
       *
       * An unset `OWNER_SIGNUP_SECRET` refuses rather than waves through: the
       * account is meant to be uncreatable until an operator deliberately sets
       * the variable, and there is no signup UI to reach this from anyway.
       */
      profile(params) {
        if (params.flow === 'signUp') {
          const secret = process.env.OWNER_SIGNUP_SECRET;

          if (secret === undefined || secret === '' || params.secret !== secret) {
            throw new Error('Sign-up is closed');
          }
        }

        return { email: params.email as string };
      },
    }),
  ],

  /**
   * 365 days total, 90 days inactive, against defaults of 30/30 (§13.3). A
   * 30-day server session re-imposes a slower version of the very re-login
   * annoyance the installed PWA's ITP exemption escapes (§14.2).
   */
  session: {
    totalDurationMs: 365 * DAY_MS,
    inactiveDurationMs: 90 * DAY_MS,
  },

  callbacks: {
    /**
     * `signUp` stays permanently — removing it would mean the account can never
     * be recreated — and is dead by construction instead: it needs both the
     * secret checked above **and** an empty `users` table (§13.4). For a
     * credentials provider this callback runs only on account creation, so the
     * count is not paid on ordinary sign-in.
     *
     * The Owner document stores nothing custom, so only the email is written —
     * in particular the signup secret arrives on `params` and is never one of
     * the fields inserted here.
     */
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (existingUserId !== null) {
        return existingUserId;
      }

      const owner = await ctx.db.query('users').first();

      if (owner !== null) {
        throw new Error('Sign-up is closed');
      }

      return await ctx.db.insert('users', { email: profile.email });
    },
  },
});
