# Runbook

Operator procedures for wardrobe-tracker. **This is not a spec** — `SPEC.md` is a
build-ready decision record you read once, in order. This file is what you open at
11pm when you cannot get in, or on release day when you need to know what to check.

Written at spec handoff rather than at need, deliberately: an undocumented recovery
path is the same as no recovery path (§13.6 of `SPEC.md`).

**Deployment:** `acrobatic-swan-379` (prod), `mellow-oyster-459` (dev).
Team `shmuel-amir`, project `wardrobe-tracker`, region eu-west-1.
**App origin:** `https://acrobatic-swan-379.convex.site` — permanent.

---

## 1. Reset the owner password

**When:** you have forgotten the password, or the password manager entry is gone.

There is **no forgot-password link and no in-app recovery** — by design. There is
exactly one user, no email vendor is wired up (§13.3), and a recovery screen on a
single-user app is a second attack surface for zero convenience.

The credential lives in a password manager. If it is lost, reset it against the
deployment:

1. Confirm you are targeting the right deployment. **Never run this against prod by
   accident** — check the banner the CLI prints.
   ```
   npx convex env list --prod
   ```
2. Convex Auth stores password hashes in the `authAccounts` table. Reset by deleting
   the account row and re-running signup with the owner secret:
   ```
   npx convex data authAccounts --prod
   npx convex run --prod <internal mutation that clears the owner's authAccount>
   ```
3. Re-create the credential. `signUp` is permanently present but **dead by
   construction** — gated on *both* the `OWNER_SIGNUP_SECRET` env var and a
   zero-existing-users check (§13.4). Set the secret, run signup, then unset it:
   ```
   npx convex env set OWNER_SIGNUP_SECRET <value> --prod
   #  ... complete signup from the app ...
   npx convex env remove OWNER_SIGNUP_SECRET --prod
   ```

> The zero-existing-users check means step 3 fails while an Owner document still
> exists. Step 2 has to actually remove it, not just the password hash.

---

## 2. Remote lockout — clear `authSessions`

**When:** a device is lost or stolen, or a session must be killed from elsewhere.

**This is the real answer to remote lockout.** Sessions are long by design — 365
days total, 90 days inactive (§13.3) — precisely so the ITP annoyance the PWA
escapes does not come back as a server-side session expiry. The cost of that choice
is that a lost device stays signed in until you do this.

```
npx convex data authSessions --prod
npx convex run --prod <internal mutation that deletes all authSessions rows>
```

Deleting **all** rows signs out **every** device including yours; sign back in on
the ones you still hold. There is no per-device session list — one user, and
building a device manager for one human is not worth the surface.

Changing the password (procedure 1) does **not** by itself invalidate existing
sessions. If the concern is that someone else has access, do both.

---

## 3. Manual Safari / PWA smoke checklist

**When:** before the native app is deleted (cutover step 11), and after any deploy
that touches the shell, the service worker, or auth.

Browser-level E2E tests are **out of scope** — ruled out on reach, not cost
(§12). Everything they would catch that the jsdom flow tests cannot — install,
service worker, real Safari behaviour — is manual territory anyway, because iOS
install is 100% manual with no `beforeinstallprompt`. This checklist is what stands
in for that tier, and pretending otherwise would be the decoration §15.6 warns
about.

Run on a **real iPhone**, not the Simulator.

### Install

- [ ] Open `https://acrobatic-swan-379.convex.site` in **Safari** (not Chrome — the
      install path is Safari-only on iOS).
- [ ] The **install-teach** screen appears *before* any login screen.
- [ ] "Skip for now" dismisses it, and it does not reappear on immediate reload.
- [ ] Share → **Add to Home Screen** works; the icon and name are correct.
- [ ] Launching from the Home Screen opens **standalone** — no address bar.

### Auth in the installed jar

- [ ] The installed app asks you to sign in **even though Safari was signed in** —
      this is expected. Storage is partitioned, and teaching install first is what
      makes this a one-time cost (§14.5).
- [ ] Sign in from the installed app. It succeeds.
- [ ] Force-quit and relaunch. **Still signed in.**

### Standalone chrome

- [ ] Every nested surface (wizard step, builder category, item detail, any
      `?sheet=`) has a **visible in-app Back or Close**. There is no browser back
      button to fall back on (§14.4).
- [ ] Content clears the notch and home indicator — `env(safe-area-inset-*)` is
      applied.
- [ ] An external link (an item's source hostname) opens deliberately and you can
      get back.

### Core flows

- [ ] Log a wear from the **wear-again strip** — one tap, no navigation, `Undo` on
      the toast works.
- [ ] Add an item by **web import** from a product page.
- [ ] Add an item where import **dead-ends** — Review holds name/brand/source, and
      the image slot accepts a **pasted** image.
- [ ] Build an outfit; leave the builder mid-way; the Outfits `+` offers **"Resume
      outfit"**.
- [ ] Start the add-item wizard, **reload the page mid-flow**, and confirm the draft
      resumes with its image intact (§5.7).
- [ ] Delete an item that is the **last garment in an outfit** — the three-outcome
      confirm appears and names the wear cost.

### Offline

- [ ] Turn on Airplane Mode. The **offline screen** appears — not a login screen and
      not an infinite spinner (§14.5).
- [ ] Turn it off. The app reconnects without a manual reload.

### The ITP boundary

- [ ] After **≥ 7 days** of daily use, the installed app is **still signed in**.
      This is the exemption the whole PWA bet rests on (§14.2); it is also the one
      item here that cannot be checked on release day.

---

## 4. Deploy

Manual, no CI secret, no deploy key (§14.6).

```
npm run deploy
```

CI runs `typecheck` + `test` only and never touches a deployment — `convex-test` is
in-memory (§15.6).
