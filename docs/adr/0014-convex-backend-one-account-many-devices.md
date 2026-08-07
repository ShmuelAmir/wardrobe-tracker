# 14. Convex is the backend; one account, many devices

- Status: Accepted
- Date: 2026-08-07
- Supersedes: [ADR-0001](./0001-on-device-only-no-accounts-cloud-sync.md)
- Owner: [#100 — Decide the auth and single-user access model](https://github.com/ShmuelAmir/wardrobe-tracker/issues/100), with research from [#90](https://github.com/ShmuelAmir/wardrobe-tracker/issues/90) and [#93](https://github.com/ShmuelAmir/wardrobe-tracker/issues/93); §13 of `SPEC.md`

## Context

ADR-0001 locked the app to on-device-only storage with no accounts, no cloud and no
sync, and treated "a lost or wiped phone means lost data" as an accepted
consequence rather than an open question.

That decision was sound for what it was, and it is not what killed the native app.
The delivery mechanism did: free-tier Apple provisioning profiles expire every 7
days, so *using* the app meant owning a Mac and re-signing it weekly. Web is the
escape hatch. Two secondary motivations arrived with it and are real requirements
rather than side effects — browsing the wardrobe from a laptop, and running
web-import on the machine where brand sites are actually being browsed.

Every clause of ADR-0001 therefore has to be reopened at once, because a web app
has no on-device store to be the source of truth and no way to be private without
an account.

## Decision

**Convex is the backend and the source of truth. There is one account, and multiple
devices signed into it concurrently is the point.**

- **Auth is Convex Auth in password mode.** No signup UI, no forgot-password link.
  The credential is a password kept in a password manager.
- **The Owner is identified by `getAuthUserId(ctx)`.** `requireOwner(ctx)` is the
  only way a function learns who is asking, and **no function anywhere accepts a
  `userId` argument**.
- **Sessions are 365 days total / 90 days inactive**, against defaults of 30/30.
- **`userId` is `v.string()` on every table**, carrying the auth user id directly.
  There is no internal `users` join and no hardcoded-owner pin.
- **Multi-device is supported, not tolerated.** Laptop and phone signed in at once
  is the stated motivation for the whole replatform.

**A hosted provider was rejected, reversing an earlier lean toward Clerk.** Free
tiers do not discriminate — Clerk 50k MRU, Auth0 25k MAU, WorkOS 1M MAU, no traps.
**The redirect condition does.** No primary source confirms that an OAuth redirect
completes inside an installed standalone PWA, and the platform mechanism against it
is documented; Auth0 is ruled out outright because Universal Login is always a
redirect. With redirects gone, a single-user login form does not want a hosted UI
either, which left Clerk offering a second vendor for one person. It remains the
sound fallback if Convex Auth's beta status becomes a problem.

**A passphrase in an env var was rejected as *more* bespoke code, not less.**
`auth.config.ts` wants a JWT, so "crude" would mean hand-rolling signing.

## Consequences

- **The trap this ADR exists to name: `getUserIdentity().subject` is not the user
  id** under Convex Auth — it is `userId|sessionId`. Had the original design
  shipped, the laptop and the phone would each have written under a different id and
  **neither device would have seen the other's wardrobe**, with no error anywhere.
  This is cross-cutting invariant #1 and one of two failures in this system that are
  silent; it is mandated as a named regression test rather than left to judgement.
- **Multi-user later is a schema-and-signup job, not a rewrite.** Because no
  function takes a `userId` and every read goes through `by_user`, the only missing
  pieces are a signup surface and a second row in `authAccounts`.
- **`signUp` stays permanently but is dead by construction** — gated on *both* an
  `OWNER_SIGNUP_SECRET` env var and a zero-existing-users check. Removing it
  entirely would mean the account could never be recreated.
- **`authTables` adds ~7 library tables** beside the app's four. There is **no dev
  auth bypass**.
- **ADR-0001's own out-of-scope list inverts.** Local DB backup/export, explicitly
  ruled out there because on-device-only was locked, is now simply Convex's problem
  rather than a reopened question — and its accepted consequence, that a lost phone
  means lost data, **stops being true**.
- **There is no in-app recovery**, and that is a deliberate trade for one user:
  two operator procedures in `docs/runbook.md` (CLI password reset; clearing
  `authSessions` for a remote lockout) instead of a recovery screen that is a second
  attack surface for zero convenience.
- **The long session is a considered cost.** A 30-day server session would
  re-impose a slower version of the exact weekly-logout annoyance the installed PWA
  escapes (ADR-0015's PWA bet, §14.2). The price is that a lost device stays signed
  in until `authSessions` is cleared.
- **Passkey is the explicit revisit trigger** — adopt when Convex Auth ships it, at
  which point the password stops being the credential.
