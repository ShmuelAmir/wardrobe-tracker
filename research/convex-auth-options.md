# Research: Authentication options for a single-user Convex PWA

Ticket: ShmuelAmir/wardrobe-tracker #90
Date: 2026-08-07
Scope: Authentication choice for `wardrobe-tracker`'s Convex-backed React+Vite web app (map #87), installed on iPhone as a PWA. **ONE user, private wardrobe, no sharing, no signup flow anyone else ever sees.** Auth's only job is proving a device belongs to that one human. Free-tier-only is a hard constraint. Schema carries `user_id` from day one for a later multi-user migration.

Prior recorded on the issue: the project owner leans toward Clerk, conditional on (a) the free tier covering one user forever with no MAU cliff or lapsing trial, (b) redirect-based sign-in surviving inside an installed iOS PWA in `standalone` mode, (c) a current, non-deprecated Convex integration. This survey does not reverse-engineer a justification for Clerk — it checks the conditions honestly.

---

## 1. Convex's own built-in auth (Convex Auth, `@convex-dev/auth`)

**Free tier:** N/A — it's a self-hosted library, not a hosted service. No signup, no vendor account, no MAU counter at all. It runs entirely inside your own Convex deployment, so it's free by construction as long as Convex itself is free (Convex's own free tier is a separate, generous constraint not audited here). [labs.convex.dev/auth]

**Convex integration:** As first-party as it gets — it *is* the Convex team's library, distributed as an npm package (`@convex-dev/auth`) with no separate backend service. [docs.convex.dev/auth] It is explicitly **in beta**: *"Convex Auth is in beta. Please share any feedback you have on Discord."* The docs also state it *"doesn't provide as many features as third party auth integrations"* — no passkeys (an open, unresolved feature request as of writing [github.com/get-convex/convex-auth#77]), no built-in UI components (you build your own sign-in form), no 2FA, no spam protection. Supported methods: magic links, email OTP, OAuth via Auth.js-style providers (GitHub, Google, Apple), and password auth with reset/verification flows. [labs.convex.dev/auth]

**PWA standalone redirect survival:** If configured with password or magic-link/OTP auth, there is **no cross-origin redirect at all** — the whole flow is a form POST to your own Convex HTTP actions, same-origin the entire time. This sidesteps the standalone-PWA redirect failure mode by construction (documented reasoning from the mechanism, not a specific PWA test). If configured with OAuth (Google/GitHub/Apple), it inherits the same generic redirect risk as any OAuth flow (see §3 below) — inferred, not separately documented by Convex.

**Forced signup UI:** None — you write your own UI. For a single-user app this is a feature (no vendor-branded "Create an account" screen), but it is also implementation cost: no pre-built components ship with the library.

**Session persistence:** Convex's client library (and Convex Auth specifically) stores the auth token in `localStorage` by default, with the `TokenStorage` interface pluggable to `sessionStorage` or a custom store. [Convex docs / DeepWiki — ConvexAuthProvider] This is the same localStorage-eviction exposure as any browser-stored session; see §"Storage eviction" below and #93.

---

## 2. Clerk

**Free tier ("Hobby"):** No credit card required. Limits, quoted from Clerk's pricing page: **"50,000 MRU (monthly retained user) limit per app,"** up to 3 dashboard seats, unlimited applications, custom domains. [clerk.com/pricing] Clerk counts **MRU (Monthly Retained Users)**, not raw MAU — *"a user only counts as retained if they return to your app at least 24 hours after signing up."* One human, used regularly, is exactly one MRU per month, so 50,000 is nowhere near a real limit for this app. If ever exceeded, Clerk gives *"a one-month grace period,"* not an immediate cutoff. **No trial-expiry trap found** — the Hobby tier is a standing free plan, not a time-boxed trial; Pro features are trial-able only in dev instances. **Verdict: genuinely free forever for one user**, on the numbers as published.

**Convex integration:** First-party and current. Convex's own auth docs list Clerk explicitly (*"has great Next.js and React Native support"*), and `docs.convex.dev/auth/clerk` is an actively maintained page with framework-specific examples (React, Next.js, TanStack Start). Setup: `auth.config.ts` with Clerk's issuer domain, `<ConvexProviderWithClerk>` wrapping `<ClerkProvider>`, then `ctx.auth.getUserIdentity()` server-side. This is a moderate but bounded amount of code (one config file, one provider wrapper, no custom backend). Token flow: `ConvexProviderWithClerk` fetches a JWT from Clerk client-side and Convex validates it against Clerk's published public key; refresh is automatic. No deprecation warning found on the current docs page.

**PWA standalone redirect survival — the highest-stakes question:** No primary source (Clerk docs, Convex docs, WebKit bug tracker, or Apple documentation) directly states "Clerk's OAuth flow works/fails inside an installed iOS PWA." What's documented instead, from primary sources, is the generic mechanism Clerk's OAuth flow rides on:
- Apple/WebKit-side: standalone PWAs only follow same-scope navigation; a navigation to a different origin (any OAuth provider's login page: `accounts.google.com`, `appleid.apple.com`, etc.) drops out of standalone display. Historically (iOS 11.3) this dropped users into a fresh Safari tab with **no shared storage**, permanently losing the session; from iOS 12.2 onward, Apple's own release notes describe an improvement where an external link that eventually redirects back *into* the PWA's scope is allowed to return control to the standalone window. [Apple Developer Forums thread 100407, 100524; Medium "What's new on iOS 12.2 for PWAs" summarizing Apple's changelog] Separately, WebKit bug **268643** shows this area is still fragile enough to regress: iOS 17.4 beta briefly force-opened *all* installed PWAs (EU only, a DMA-compliance side effect) into Safari before Apple reverted it in the 17.4 stable release. [bugs.webkit.org/show_bug.cgi?id=268643]
- Storage isolation is confirmed directly: *"Session, cookies, local storage, and even Service Worker instance is not shared between Safari and standalone mode on iOS."* [Netguru / community consensus corroborated by Apple Developer Forums thread 125109 on cross-origin storage limits] This means even when the 12.2+ "return to scope" behavior works, any state Clerk's SDK tried to stash mid-flow in the *Safari* context (as opposed to a server-side `state`/PKCE parameter carried in the redirect URL itself) would not be visible back in the PWA context.
- No Clerk-specific bug report, changelog entry, or docs page was found (searched Clerk docs, Clerk GitHub, Clerk community, dev.to write-ups) confirming or denying that Clerk's specific OAuth implementation completes cleanly in an installed iOS PWA. The closest adjacent evidence is a Clerk Flutter SDK issue about OAuth providers not rendering on iOS (a different, native-wrapper context, not strictly this failure mode) and a general pattern (Auth0 community, PocketBase, next-auth, PWABuilder, forem/dev.to) of **the same class of bug recurring across unrelated stacks whenever "installed PWA + provider redirect for OAuth" is combined** — evidence that this is a platform-level risk, not something any given SDK provider has "solved," but not proof either way for Clerk specifically.
- **Important scope-narrowing fact:** the redirect risk applies specifically to *OAuth social login* (Google/Apple/GitHub button), because that's what forces a cross-origin hop. Clerk also supports **embedded, same-origin UI** (`<SignIn/>` component, or email/password/passkey) that does not need to leave the PWA's origin at all — for a single-user app, this path is available and avoids the entire failure class.

**Verdict on condition 3:** Undetermined by primary evidence for OAuth-button sign-in; the underlying platform mechanism (cross-origin navigation drops standalone display, storage isolated from Safari, historically prone to regressions per WebKit 268643) is real and documented, so this remains a live risk rather than a cleared bar. **If Clerk is used with email/password or passkey (no OAuth button), the redirect risk does not apply** because there's no cross-origin hop.

**Forced signup UI:** Clerk's embeddable components (`<SignIn/>`, `<SignUp/>`, `<UserButton/>`) are designed for multi-user SaaS by default (they show organization/invite affordances unless configured off) but can be configured down to a plain email/password (or single hardcoded account) form. Not "forced," but it is vendor UI aimed at a different use case than a private single-user app, requiring configuration to pare down.

**Token/session persistence:** Clerk's session cookie (`__session`) carries a short-lived (60-second) JWT for XSS mitigation, refreshed silently in the background; the **overall session defaults to a 7-day maximum lifetime**, configurable. [clerk.com/docs — session options / "How We Roll: Sessions"] The client SDK can store the token in `localStorage` or "a native equivalent." Interaction with #93 (iOS storage eviction): a 7-day rolling session means Clerk depends on either its refresh cookie or localStorage token surviving between app opens; if iOS evicts site storage (Convex's own token cache is also localStorage-based, per §1), both Clerk and Convex would need to re-authenticate, i.e. the two systems fail together, not independently.

---

## 3. Auth0

**Free tier:** **"Up to 25,000 monthly active users,"** no credit card, no trial expiry — a standing free plan, not a time-boxed trial. [auth0.com/pricing] One user is trivially inside this. Includes passwordless auth, unlimited social connections, 1 enterprise connection, self-service SSO, 5 organizations, 1 custom domain, community support only, 1-day log retention. No seat minimum found. **Verdict: genuinely free forever for one user.**

**Convex integration:** First-party and current — `docs.convex.dev/auth/auth0` is an actively maintained guide referencing an example repo (`convex-demos`). Setup: complete Auth0's React quickstart, `convex/auth.config.ts` with domain/client ID, wrap the app in `Auth0Provider` + `ConvexProviderWithAuth0`, use `useAuth0()` for login/logout buttons that **redirect to Auth0's Universal Login page** (hosted, off-origin, by design — this is Auth0's standard flow, not an embedded-widget option like Clerk's). No deprecation notes found.

**PWA standalone redirect survival:** Same underlying platform mechanism as §2 applies, and it's *unavoidable* with Auth0's standard integration, because Auth0's React SDK is built around **Universal Login** — a full off-origin redirect is the default and recommended flow, with no first-party embedded-widget alternative comparable to Clerk's `<SignIn/>`. That makes Auth0 *more*, not less, exposed to the standalone-PWA redirect risk than Clerk, since there's no same-origin escape hatch. No Auth0-authored documentation was found that specifically addresses installed-PWA standalone-mode behavior (an official community-forum thread on this exact topic returned 404 when checked directly); the generic platform risk from §2 (cross-origin navigation drops standalone display; storage isolated from Safari; WebKit 268643 regression) applies unmitigated.

**Forced signup UI:** Universal Login is a hosted, Auth0-branded page; it can be customized but is inherently a redirect to Auth0's domain — not something a private single-user app can avoid the way Clerk's embedded components allow.

**Session persistence:** Not directly sourced in this pass; Auth0's SDKs default to similar client-side token caching patterns. Not independently verified — flag as unknown rather than inferred.

---

## 4. WorkOS AuthKit

**Free tier:** **"First 1M MAUs"** free, then $2,500/mo per additional million. [workos.com/pricing] Includes email+password, social login, passkeys, MFA, magic auth, and enterprise SSO "all from one integration." No trial period or seat minimums found; billing applies to production only (staging is free). **Verdict: trivially free forever for one user** — the largest headroom of any option surveyed.

**Convex integration:** First-party and current — `@convex-dev/workos-authkit` is an official Convex component (listed at convex.dev/components/workos-authkit, docs at docs.convex.dev/auth/authkit/), maintained by the Convex team (`get-convex/workos-authkit` on GitHub), with webhook-driven user sync into Convex tables. This is more integration surface than Clerk/Auth0 (a full component with its own data sync), which is more code but also deeper Convex-side integration.

**PWA standalone redirect survival:** No primary evidence found either way — WorkOS's own docs and Convex's WorkOS docs were not checked for PWA-specific guidance in this pass, and AuthKit's hosted sign-in page is redirect-based like Auth0's, which would carry the same generic platform risk as §2/§3. Treat as **unknown, inferred-risky** rather than documented.

**Forced signup UI:** AuthKit is explicitly *"built for B2B apps"* per Convex's own auth docs — organization/team primitives are central to its product, a worse fit for a single-user private app than Clerk or plain Convex Auth. Not strictly "forced," but it's the most misaligned of the surveyed options for this use case.

---

## 5. better-auth (`@convex-dev/better-auth`)

**Free tier:** N/A in the vendor sense — better-auth is a self-hosted, open-source TypeScript auth library, not a hosted service with an MAU meter. Same free-by-construction argument as Convex Auth (§1): cost is bounded by Convex's own free tier, not a third-party auth vendor's pricing table.

**Convex integration:** First-party and actively maintained — `@convex-dev/better-auth` (current version 0.10.13 per npm) is an official Convex component providing a Convex-backed data adapter, an HTTP routing bridge mounting better-auth's endpoints onto Convex's HTTP router, and a `convex()` JWT plugin producing valid Convex identity tokens. Framework helpers exist for React, Next.js, TanStack Start. [labs.convex.dev/better-auth; convex.dev/components/better-auth] This is the newest of the surveyed options and carries the most moving parts to wire up (component + adapter + plugin), though "first-party and current" holds.

**PWA standalone redirect survival:** better-auth supports both OAuth (redirect-based, same generic risk as any OAuth provider) and email/password or magic-link flows that, like Convex Auth, can be kept entirely same-origin. No PWA-specific documentation found from better-auth or Convex; the same reasoning as §1 applies — the risk is a function of *which auth method* is chosen, not of better-auth itself.

**Forced signup UI:** None shipped — better-auth is headless/library-first like Convex Auth; you build the UI.

**Session persistence:** Not independently sourced in this pass for better-auth specifically; expected to follow the same client-storage patterns as Convex's other client libraries (localStorage-backed) based on the general Convex client behavior documented in §1, but this is inferred, not confirmed against better-auth's own docs.

---

## 6. Deliberately cruder options

**Single shared secret / long-lived token (e.g., a passphrase typed once, stored as a Convex-issued token in `localStorage`, checked server-side on every request):**
- Free: trivially, there's no vendor at all.
- Integration cost: minimal — a Convex mutation that checks a password against an environment-variable secret and returns a long-lived signed token, stored client-side, sent as a header. No `auth.config.ts`, no JWKS, no third-party SDK.
- PWA redirect risk: **zero** — there is no redirect, no cross-origin hop, nothing for iOS's standalone-mode navigation rules to break. This is the only option in this survey with no dependency on the exact failure mode condition (c) worries about.
- Signup UI: none — literally a password field.
- Persistence: entirely up to you; store it in `localStorage` (subject to the same eviction risk as every other option, see #93) or, better, rely on iOS Keychain-backed storage if wrapped as a PWA with `credentials: 'include'` + a `Secure`/`SameSite=Strict` cookie set by a Convex HTTP action, which survives independently of JS-readable storage.
- Downside: this is genuinely a security downgrade (one static secret, no rotation, no breach-notification tooling, no anomaly detection) — acceptable *only* because the threat model here is "prove this device is the owner's phone," not "protect against credential-stuffing at scale."

**Passkey-only (WebAuthn via `navigator.credentials`, no third-party vendor):**
- Free: yes, WebAuthn is a browser API, not a paid service.
- Integration cost: moderate — you need a relying-party WebAuthn implementation (register + assert), which Convex Auth explicitly does **not** provide (open feature request, §1), so this would mean hand-rolling WebAuthn against Convex actions, or picking a provider that supports it (Clerk, Auth0, WorkOS AuthKit all list passkey support).
- PWA redirect risk: **effectively zero** — WebAuthn's `navigator.credentials.create()`/`.get()` calls are same-origin, in-page API calls; there is no cross-origin redirect involved, so this sidesteps condition (c) by construction. Apple's WebAuthn/passkey support (iCloud Keychain-backed, announced WWDC21) is available in Safari-engine contexts including installed PWAs — the credential is scoped to the origin and resolved via Face ID/Touch ID without leaving the page. [general WebAuthn/passkey documentation corroborated across Hanko, Auth0, and Apple's WWDC21 announcement; no PWA-specific edge case documented, but the mechanism itself has no redirect step]
- Signup UI: minimal — "Set up Face ID" is a one-screen affordance, not a full account-creation flow.
- Downside: passkey UX assumes the *same device* going forward; recovery (new phone) needs a fallback path, which reintroduces the shared-secret idea above as a bootstrap/recovery mechanism.

---

## Does a single-user app need any of this?

**Argued honestly: no, not the vendor-hosted options.** The entire reason Clerk/Auth0/WorkOS exist is to manage *populations* of users — signup funnels, MRU/MAU billing, organizations, breach detection, social login matrices, compliance. This app has exactly one identity, known in advance, never rotating providers. Every vendor surveyed here that is redirect-based (Auth0 unconditionally, Clerk/WorkOS when using OAuth buttons) inherits a real, still-not-fully-resolved-by-Apple platform risk (§3, WebKit 268643) purely to solve a problem — federated identity across a population — that doesn't exist for this app.

The materially simpler correct answer is **same-origin auth with no redirect dependency**: either Convex Auth (§1) configured for password/magic-link only (skip its OAuth option), better-auth (§5) configured the same way, or the deliberately crude single-secret/token approach (§6) — all three share the property that condition (c) from the issue ("survives inside an installed iOS PWA in standalone mode") is satisfied *by construction*, not by hoping a vendor's SDK handles it, because none of them ever navigates the browser away from the PWA's origin. Passkey-only (§6) is the strongest version of this if the extra WebAuthn implementation work is acceptable, since it also gets device-bound biometric security for free.

**If Clerk is still preferred** (per the recorded owner lean), the way to actually clear condition (c) is to **not use its OAuth/social-login button** — use Clerk's embedded email/password (or passkey) component instead, which is same-origin and avoids the redirect question entirely. That gets Clerk's free tier (§2, genuinely unlimited for one user) and current first-party Convex integration without touching the one part of Clerk that carries the documented platform risk.

**Not recommended:** Auth0 (redirect is unavoidable with its standard SDK — the worst match for condition (c) of any option surveyed) and WorkOS AuthKit (B2B-shaped product, and PWA behavior wasn't found documented anywhere, so it can't currently be certified against condition (c) either).

---

## Comparison table

| Option | Free forever for 1 user? | Convex integration | Redirect required? | Standalone-PWA risk | Forced multi-user UI? | Session storage |
|---|---|---|---|---|---|---|
| Convex Auth (password/OTP) | Yes (no vendor) | First-party, **beta** | No | None (same-origin) | No (build your own) | localStorage (client-configurable) |
| Convex Auth (OAuth mode) | Yes (no vendor) | First-party, **beta** | Yes | Same generic risk as any OAuth | No | localStorage |
| Clerk (OAuth button) | Yes — 50k MRU/mo, 1-mo grace period | First-party, current | Yes | **Undetermined**, real platform risk (WebKit 268643 etc.), no Clerk-specific evidence found | Configurable down, not zero-config | localStorage/cookie, 7-day default session |
| Clerk (embedded email/password or passkey) | Yes | First-party, current | **No** | None (same-origin) | Configurable down | Same as above |
| Auth0 | Yes — 25k MAU/mo, no trial trap | First-party, current | **Yes, unavoidable** (Universal Login is the standard flow) | Same undetermined/high platform risk, no escape hatch | Hosted, Auth0-branded page | Not independently verified |
| WorkOS AuthKit | Yes — 1M MAU/mo (most headroom) | First-party, current, but heavier (webhook sync) | Yes (hosted page) | Unknown — not documented either way | B2B-oriented, worst fit for single-user | Not verified |
| better-auth | Yes (no vendor) | First-party, current, newest/most moving parts | Configurable (avoidable) | None if same-origin mode chosen | No (headless) | Inferred localStorage-based, not confirmed |
| Single shared secret / long-lived token | Yes (no vendor) | Trivial, hand-rolled | **No** | None | No | Your choice (localStorage or Secure cookie) |
| Passkey-only (WebAuthn) | Yes (browser API) | Moderate (hand-rolled or via a provider) | **No** | None (same-origin API call) | No | Platform Keychain-backed, not app storage |

---

## Recommendation

**Convex Auth, configured for password (or magic-link) sign-in only, with the OAuth option left unused.** Reasoning:

1. It is the only option that is simultaneously (a) unconditionally free with zero vendor MAU accounting, (b) first-party to Convex, and (c) structurally immune to the standalone-PWA redirect failure mode — because there's no redirect in this configuration, not because a vendor claims to have solved it.
2. Its beta status is a real cost (no passkeys yet, roll-your-own UI, possible breaking changes) but for a one-screen, one-user login form, "beta" mostly means "smaller surface area to break," and the app owner controls the upgrade timing since there's no hosted service to fall out of sync with.
3. It removes a vendor from the dependency graph entirely, which the issue itself flags as worth something ("one fewer vendor is worth something in a single-user app").

**If the owner's Clerk lean holds regardless**, the fallback recommendation is **Clerk, restricted to its embedded email/password or passkey component — never the OAuth/social button** — which clears all three conditions from the issue comment: free tier genuinely covers one user forever (50k MRU with a grace period, no trial trap), the Convex integration is first-party and current, and by not using OAuth, the redirect question is moot rather than merely hoped-to-work. Using Clerk's OAuth button remains the one path in this whole survey with a documented-but-unresolved platform risk (§2) and should be avoided regardless of which provider is chosen.

**Not recommended:** Auth0 (redirect is unavoidable with its standard SDK — the worst match for condition (c) of any option surveyed) and WorkOS AuthKit (B2B-shaped product, and PWA behavior wasn't found documented anywhere, so it can't currently be certified against condition (c) either).

---

## Conflicts / uncertainties

- No primary source — not Clerk's, not Convex's, not WebKit's — directly confirms or denies that Clerk's specific OAuth SDK completes cleanly inside an installed iOS standalone PWA. The generic platform mechanism (cross-origin nav breaks standalone; storage isolated from Safari; WebKit 268643 shows this area still regresses) is documented; a *provider-specific* test was not found and was outside what a docs/websearch pass can confirm. Recommend an actual empirical test (build the PWA, install on a real iPhone, try the OAuth button) before finalizing if OAuth sign-in is ever wanted later.
- Auth0's own community-forum thread on this exact topic (searched: "Login to PWA on iOS Using Social Identity Provider") returned a 404 when fetched directly; only WebSearch's index summary of it was available secondhand, so it's treated as unconfirmed folklore, not cited as evidence, and omitted from the primary claims above.
- WorkOS AuthKit's and better-auth's session-storage/persistence specifics were not independently verified against their own docs in this pass — flagged as unknown rather than inferred.
- Auth0 session persistence details were not sourced in this pass.
- The interaction with #93 (iOS storage eviction) is noted qualitatively wherever a provider's token storage was confirmed as localStorage-based (Convex's own client, and by extension Convex Auth); it was not separately re-derived here since #93 owns that investigation.

---

## Sources

- https://docs.convex.dev/auth
- https://docs.convex.dev/auth/clerk
- https://docs.convex.dev/auth/auth0
- https://docs.convex.dev/auth/authkit/
- https://docs.convex.dev/auth/advanced/custom-auth
- https://labs.convex.dev/auth
- https://labs.convex.dev/auth/faq
- https://github.com/get-convex/convex-auth/issues/77
- https://github.com/get-convex/convex-auth
- https://labs.convex.dev/better-auth
- https://www.convex.dev/components/better-auth
- https://www.convex.dev/components/workos-authkit
- https://github.com/get-convex/workos-authkit
- https://clerk.com/pricing
- https://clerk.com/docs/guides/secure/session-options
- https://clerk.com/blog/how-we-roll-sessions
- https://auth0.com/pricing
- https://workos.com/pricing
- https://bugs.webkit.org/show_bug.cgi?id=268643
- https://developer.apple.com/forums/thread/100407
- https://developer.apple.com/forums/thread/100524
- https://developer.apple.com/forums/thread/125109
- https://developer.apple.com/forums/thread/649699
- https://github.com/pocketbase/pocketbase/discussions/2429
- https://github.com/nextauthjs/next-auth/issues/7442
- https://github.com/clerk/clerk-sdk-flutter/issues/212
- https://github.com/pwa-builder/PWABuilder/issues/2433
- https://github.com/pwa-builder/PWABuilder/issues/5115
