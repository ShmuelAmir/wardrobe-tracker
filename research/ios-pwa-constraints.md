# Research: what an installable PWA actually gets on iOS Safari

Ticket: ShmuelAmir/wardrobe-tracker #93
Date: 2026-08-07
Scope: Home-screen-installed web app ("Home Screen web app" in Apple/WebKit terminology) behaviour on **current iOS — iOS 17/18/26, i.e. WebKit's ITP/Storage-API/Web-Push behaviour as of Safari 17–26 (Sept 2023 – Sept 2025 releases, still current at time of writing)**. iOS 26 (released Sept 15, 2025) is the latest public release; iOS 27 is in developer beta as of this writing but not covered here except where noted. Where behaviour changed across versions, the version is called out inline.

## Verdict

**Yes — an installed iOS PWA is a viable primary phone client for this app**, with the storage-eviction fear resolved in the app's favor: WebKit explicitly exempts Home Screen web apps from the 7-day ITP storage cap, and as of Safari 17 they get the *same* origin storage quota as Safari itself (60% of disk), not the smaller allowance given to plain in-app WKWebViews. That removes the scariest hypothesis (silent weekly logout) as the default case.

The top 3 things the spec must design around:

1. **Auth persistence is not "solved," it's "not eviction-scheduled."** The 7-day ITP cap doesn't apply, but iOS 17.x has an *open, unresolved* WebKit bug (session cookies randomly reverting to stale values in Home Screen web apps) and storage can still be evicted under system storage pressure or if the user never opens the app for a long stretch (LRU eviction against the *overall* quota, not a fixed calendar timer). Store the auth token in a way that degrades gracefully — detect invalidation and re-prompt sign-in rather than assuming persistence is guaranteed indefinitely. Avoid cookie-based session auth entirely if possible, given the open regression; prefer a token in IndexedDB/localStorage read explicitly by the app.
2. **No install prompt, no back button, no reliable external-link handling.** `beforeinstallprompt` is Chromium-only — iOS install is 100% manual via the Share-sheet "Add to Home Screen," so the spec needs an in-app "how to install" instructional UI (with iOS-specific graphics/copy), not a JS-triggered prompt. Standalone mode has no browser chrome at all — no back/forward affordance — so in-app navigation (a header back button, or edge-swipe-to-go-back via router state) is mandatory, and any off-origin link (including a full-page OAuth redirect) risks kicking the user out to Safari with no guaranteed automatic return.
3. **OAuth redirect-based sign-in is the single highest-risk feature to add later.** Cross-origin redirect flows historically break out of standalone mode into Safari, and even same-origin session cookies have a live, unresolved WebKit regression (bug 272325) affecting Home Screen web apps on iOS 17.x. Given Convex + a token-based auth already decided, this argues strongly for **avoiding full-page OAuth redirects** in favor of a flow that keeps the user inside the standalone shell (e.g., magic link / OTP / a Convex-issued token flow) — this is now an input to #90/#100, not just a note.

---

## 1. Install flow

**Manual only — Add to Home Screen via the Safari Share sheet.** There is no way to programmatically trigger an "install this app" prompt on iOS Safari.

- `beforeinstallprompt` is part of the WICG "Manifest Incubations" draft (a Chromium proposal, not a W3C/WHATWG standard) and MDN's compatibility notes mark it as **not supported by Safari on either desktop or iOS** — "not Baseline because it does not work in some of the most widely-used browsers." [MDN — `beforeinstallprompt` event]
- The only install path on iOS is the user tapping Share → **Add to Home Screen** in Safari itself. This is a purely manual, user-initiated action — nothing in JS can invoke it, detect its availability, or fire on completion (beyond the app noticing `navigator.standalone === true` / display-mode media query on next launch).
- iOS uses `<link rel="apple-touch-icon">` as its primary home-screen icon source rather than the Web App Manifest's `icons` array — if no `apple-touch-icon` link is present, iOS falls back to a screenshot of the page. Common sizes cited across developer references (not a single canonical Apple spec page) are 120×120, 152×152, 167×167, and 180×180 depending on device. [Apple developer forums thread 65450 — corroborated by community references only for the exact size table]
- A Web App Manifest with `display: standalone` (or `fullscreen`/`minimal-ui`) is still required for the app to be recognized as a proper installable web app for **other** iOS-version-gated features — notably Web Push (see §8) requires the manifest and `display: standalone`/`fullscreen`, not just `apple-mobile-web-app-capable`. [WebKit — Web Push for Web Apps on iOS and iPadOS]

**Spec implication**: build an explicit "Add to Home Screen" instructional screen shown to non-standalone visitors; do not build any UI branch that waits for/relies on `beforeinstallprompt`.

---

## 2. `standalone` display mode behaviour

- Setting `apple-mobile-web-app-capable` to `yes` (legacy meta tag; the manifest's `display: standalone` is also honored) removes Safari's chrome entirely: no URL bar, no bottom toolbar. [Apple — "Configuring Web Applications" developer documentation, accessed via search index; page currently returns HTTP 403 to direct fetch but content corroborated by multiple technical references quoting it verbatim]
- `window.navigator.standalone` (iOS-only, non-standard) is the documented way to detect standalone mode at runtime. [Same source]
- **Safe areas**: `env(safe-area-inset-top/right/bottom/left)` only resolve to non-zero values if the viewport meta tag includes `viewport-fit=cover`; without it, Safari letterboxes content with blank bars, especially in landscape. This is documented WebKit/CSS Env Variables behavior referenced consistently across developer sources; the underlying mechanism (`viewport-fit`) is a CSS Working Group spec feature Apple's WebKit implements. **Spec implication**: the manifest/meta viewport must set `viewport-fit=cover`, and CSS must explicitly pad against `env(safe-area-inset-*)` for the status-bar area and (critically, for iPhones with a home indicator) the bottom inset.
- **Back navigation**: there is no system-level back gesture/button in standalone mode (no browser UI at all) — the app is fully responsible for in-app navigation history. This is inferred from "no URL bar, no button bar" plus consistent community confirmation; no single Apple doc states "there is no back button" in those words, but it follows directly from documented chrome removal.
- **External links**: standalone mode is documented to have no browser chrome, and the observed/community-confirmed default behavior (not spelled out in a single authoritative Apple statement, so labeled **inferred/community-corroborated**) is that tapping a link — including `target="_blank"` or an off-origin `<a>` — pulls the user out of the standalone shell into Safari (or, on iOS 17+, sometimes into an embedded in-app browser sheet depending on link/context), and the user must manually navigate back to the Home Screen icon to return; there is no guaranteed automatic return trip. This is exactly the mechanism that makes OAuth redirects risky (§4).

---

## 3. Storage eviction (the highest-stakes item)

**Primary finding: Home Screen web apps ARE exempt from the 7-day ITP script-writable-storage cap.**

- WebKit's ITP (Intelligent Tracking Prevention), introduced in Safari 13.1 / iOS 13.4 (April 2020), added: *"ITP has aligned the remaining script-writable storage forms with the existing client-side cookie restriction, deleting all of a website's script-writable storage after seven days of Safari use without user interaction on the site."* Affected storage: IndexedDB, LocalStorage, Media Keys, SessionStorage, Service Worker registrations and cache. [WebKit blog — "Full Third-Party Cookie Blocking and More," webkit.org/blog/10218]
- The **same post** carves out the exemption explicitly: *"Web applications added to the home screen are not part of Safari and thus have their own counter of days of use. Their days of use will match actual use of the web application which resets the timer. We do not expect the first-party in such a web application to have its website data deleted."* [same source]
- WebKit's current, maintained summary page restates this as policy, not just a 2020 announcement: *"ITP deletes all cookies created in JavaScript and all other script-writable storage after 7 days of no user interaction with the website,"* and separately: *"The first-party domain of home screen web applications is exempt from ITP's 7-day cap on all script-writeable storage,"* and *"the website data of home screen web applications is kept isolated from Safari and thus will not be affected by ITP's classification of tracking behavior in Safari."* [WebKit — "Tracking Prevention in WebKit," webkit.org/tracking-prevention — this is WebKit's living/updated reference page, current as of research date]

**What this means for a persisted auth token**: an auth token in IndexedDB/localStorage inside an installed (Add-to-Home-Screen) PWA is **not** subject to the 7-day silent-logout timer that plagues plain Safari tabs/bookmarks. The user will **not** be auto-logged-out on a fixed weekly schedule purely from being installed. This directly de-risks #90/#100's assumption that "the PWA route" implies unavoidable weekly re-auth.

Caveats — this is "documented, not risk-free":
- **This exemption applies only if the app is genuinely launched in standalone/installed mode.** A bookmark or a link opened inside Safari itself (not the installed icon) still gets Safari's 7-day treatment. The spec must ensure users install via Add to Home Screen, not just bookmark the URL.
- **A separate, open, unresolved bug exists**: WebKit Bugzilla #272325, "REGRESSION (iOS 17.x): Session cookies being reset randomly in a Home Screen web app," filed and reproduced by Apple engineers, status **NEW/unresolved** as of the last update recorded (mid-2024), affecting iOS 17.2–17.4.1 and reportedly still present in early iOS 18 betas at the time. Symptom: specific cookies silently revert to a stale/persistent value without any `Set-Cookie` from the server, breaking session auth unpredictably (observed ~0.35% of iPhone users in one large deployment, more common on iPad). **This is a cookie-specific bug** (not documented against localStorage/IndexedDB token storage) but it is a live, primary-sourced counter-example to "storage in an installed PWA is fully reliable." [WebKit Bugzilla #272325]
- **LRU eviction under storage pressure still exists** and is not calendar-based: see §9 — if overall device storage is tight, an origin's data (including this one) can still be evicted based on least-recently-used ordering, not a 7-day timer. Rare on a personal-use app opened regularly, but not impossible if the phone is nearly full.

**Design recommendation flowing from this**: prefer a token-storage mechanism the app controls directly (IndexedDB/localStorage) over relying on cookies for session state, given the open cookie-specific regression; and build a "silently re-authenticate or clearly prompt sign-in" path regardless, since "not scheduled for eviction" is not the same guarantee as "will never be evicted."

---

## 4. OAuth redirect flows in standalone mode

No single current WebKit blog post documents this behavior end-to-end; the evidence is a documented mechanism (§2's external-link behavior) plus a directly relevant, currently-open primary-source bug:

- **Mechanism**: because standalone mode has no browser chrome and (per community-corroborated, undocumented-by-Apple default behavior) an off-origin navigation pulls the user into Safari/an in-app browser sheet, a full-page redirect to an OAuth provider (Google, Apple, etc.) and back is exactly the kind of navigation that historically "breaks out" of the standalone shell. Once in Safari, the redirect back to the app's origin lands in a normal Safari tab, **not** back inside the installed standalone instance — the session state established in that Safari tab does not automatically appear inside the Home-Screen app's separate storage partition, since (§3) "the website data of home screen web applications is kept isolated from Safari." [WebKit — Tracking Prevention in WebKit]
- **Directly relevant open bug**: WebKit Bugzilla #272325 (above) shows that even *same-origin* session cookies inside a Home Screen web app are currently unreliable on iOS 17.x for reasons Apple engineers have not yet root-caused as of the bug's last update. This is a stronger, more current signal than the historical "OAuth breaks in standalone" folklore, and it's primary-sourced.
- **No WebKit or Apple documentation was found stating OAuth-in-standalone is supported or guaranteed to work.** Absence of a fix/guidance in the primary sources should be read as **unknown/unresolved**, not as "safe."

**Conclusion for the spec**: treat full-page OAuth redirect as high-risk and currently under-documented/actively-buggy for standalone iOS web apps. If external identity-provider sign-in is wanted, prefer a flow that does not require leaving the standalone shell's storage partition (e.g., popup-less OTP/magic-link email flow terminating same-origin, or a server-mediated flow where the token is delivered via a mechanism that doesn't depend on the redirect landing back inside the *same* storage partition as the standalone app). This is a hard constraint to feed directly into #90/#100.

---

## 5. `<input type="file">` and photo-library access

- The `accept` and `capture` attributes are both standard HTML (WHATWG HTML spec via MDN). `accept` filters by MIME type or extension (e.g., `image/*`) but per spec is a *hint*, not a validator — "doesn't validate the types of the selected files." `capture` (values `user`/`environment`) requests a specific camera-facing mode when the browser offers direct capture; if omitted, "the user agent is free to decide on its own what to do." [MDN — `<input type="file">`, citing WHATWG HTML spec]
- **iOS-specific behavior is not covered by Apple/WebKit primary documentation found in this research** — MDN's own file-input page does not document iOS Safari–specific picker UI. What follows is community-corroborated, not primary-sourced, and should be labeled as such: with `accept="image/*"` and no `capture` attribute, iOS Safari shows a picker sheet offering **Photo Library**, **Take Photo or Video**, and **Choose File** (Files app) as options; adding `capture` narrows this toward directly launching the Camera app. Since this project has explicitly decided **camera capture is OUT** (file upload replaces it), the relevant path is `accept="image/*"` without `capture`, which is reported to still surface the Photo Library option in the sheet — but this specific point is **inferred from community sources, not confirmed by a primary Apple/WebKit reference**, and should be spot-checked on-device before the spec finalizes copy/UX around "choose photo."
- iOS Safari requires the file picker to be triggered by a genuine user gesture (a real tap/click) — it cannot be invoked from arbitrary script (`input.click()` fired outside a user-gesture handler is unreliable). This is consistent with WebKit's general user-gesture-requirement model for privacy-sensitive input triggers, though no single primary citation was located spelling this out for file inputs specifically; treat as **inferred, high-confidence** given it matches WebKit's documented posture on autoplay/permission-prompts elsewhere.

**Spec implication**: build the "add photo" UI as a real, directly-tappable `<label>`/button wired to a visible-but-styled `<input type="file" accept="image/*">`, not a programmatically-triggered click from an unrelated event handler.

---

## 6. Service workers

- **Supported**, since Safari Technology Preview 48 / iOS 11.3 beta 2 (early 2018) — old news by 2026, but this is the origin point: *"Service Worker API... Safari, SFSafariViewController, and Home Screen web applications"* (an initial post draft incorrectly said "all WKWebView apps"; WebKit corrected it to the three contexts listed). [WebKit blog — "Workers at Your Service," webkit.org/blog/8090]
- **Registrations and caches are subject to a "few weeks" unused-cleanup policy independent of ITP's 7-day rule**: *"WebKit will remove unused service worker registrations after a period of a few weeks. Caches that do not get opened after a few weeks will also be removed."* [same source] — note this predates, and is separate from, the more specific 60%/15% quota and LRU-eviction policy described in §9; both mechanisms exist, and the newer Storage API policy (2023) is the more authoritative current framing of eviction generally.
- **Cache API quota**: historically described as "a fixed value of 50 MiB per partition" in the original 2018 post; superseded by the 2023 Storage Policy update (§9) which ties cache/service-worker storage into the same origin-quota and LRU-eviction model as everything else, rather than a flat 50MiB ceiling. Treat the 50MiB figure as legacy/historical, not current.
- **Partitioning quirk**: WebKit partitions service workers (and their clients) by top-level document origin beyond the base spec, for tracking-prevention reasons — relevant only if this app ever embeds third-party origin content, which it does not currently plan to. [webkit.org/blog/8090]
- No primary source was found describing standalone-mode-specific service worker update quirks beyond what's documented above; update behavior (new SW version activation, `skipWaiting`, etc.) is treated as standard-spec behavior with no iOS-specific override found.

---

## 7. WebSocket behaviour when backgrounded/resumed

No dedicated WebKit blog post was found on this exact topic; the sourced picture comes from Apple Developer Forums threads (primary — Apple's own forum, DTS engineers participate, but not an authoritative spec/doc page) plus general iOS background-execution documentation:

- **Apps (and by extension backgrounded Safari/standalone web app tabs) cannot perform networking while suspended.** iOS suspends backgrounded processes; a suspended context gets no CPU time to service a socket. [Apple Developer Forums — general background-execution threads, corroborating Apple's documented app-suspension model]
- **Observed behavior**: when Safari/the standalone app is backgrounded, the server-side sees the client disconnect and the connection is dropped; when the app returns to foreground shortly after, `onerror`/`onclose` fire and the page can reconnect. **After longer backgrounding**, those close events may not fire reliably at all — the page has no way to know the socket died until it tries to use it, so **the app must not assume the WebSocket is alive on resume and must actively verify/reconnect** rather than relying on close-event-driven reconnect logic. [Apple Developer Forums thread discussion, corroborated pattern — labeled as forum-sourced, not a formal spec/doc guarantee]

**Spec implication for Convex**: since Convex's reactive subscription runs over a persistent WebSocket, the client must treat "app resumed from background" as an explicit trigger to re-establish/re-verify the subscription and re-sync state, rather than trusting the socket's own event lifecycle to have fired correctly during backgrounding. This is standard practice for Convex's client SDK reconnection logic generally (it already reconnects on visibility/network change) but iOS backgrounding makes the "stale socket, no close event" case more likely than on desktop, so it's worth explicit QA.

---

## 8. Push notifications

**Supported, but only for installed Home Screen web apps, and not needed for v1.**

- iOS/iPadOS 16.4 (beta Feb 16, 2023) introduced Web Push for Home Screen web apps: *"A web app that has been added to the Home Screen can request permission to receive push notifications as long as that request is in response to direct user interaction — such as tapping on a 'subscribe' button provided by the web app."* Requires Push API + Notifications API + a Service Worker, and the site must be added to the Home Screen with a manifest whose `display` is `standalone` or `fullscreen` — a plain Safari tab or a home-screen bookmark without a proper manifest cannot receive push. [WebKit blog — "Web Push for Web Apps on iOS and iPadOS," webkit.org/blog/13878]
- Notifications delivered this way behave like native-app notifications: Lock Screen, Notification Center, paired Apple Watch, and per-app management in Settings. [same source]
- **Declarative Web Push** (WebKit blog, "Meet Declarative Web Push," May 2025, webkit.org/blog/16535) later extended this so a push subscription and visible notification can be requested/shown **without a running/installed service worker** in some cases — a 2025-era refinement, noted for completeness but not required reading for v1 since push is explicitly out of scope now.

---

## 9. Storage quota

- As of **Safari 17 / iOS 17 / iPadOS 17 / macOS Sonoma (Sept 2023)**, the Storage API (`navigator.storage.estimate()`) is fully supported, and WebKit's storage policy was overhauled: *"For a browser app, the origin quota is up to 60% of the total disk space, while for other apps, the origin quota is up to 15% of the total disk space."* Cross-origin iframes get 10% of the main frame's origin quota. [WebKit blog — "Updates to Storage Policy," webkit.org/blog/14403]
- **Critically for this project**: *"When a web app is running standalone (as Home Screen Web App on iOS or Web App added to dock on macOS), it has the same origin quota and overall quota as when it is opened in a browser app."* — i.e., an installed PWA gets the **60%-of-disk "browser app" allowance**, not the smaller 15% given to generic embedded WKWebViews. [same source]
- **Eviction model**: eviction happens under overall-quota pressure or system storage pressure, using **least-recently-used ordering** — *"The last use time is the time of the last user interaction, or the time of the last storage operation"* — not a fixed calendar schedule. Origins with an open page, or using persistent-storage mode, are excluded from eviction. [same source]
- **Historical context**: prior to this 2023 policy, origins had a flat starting limit around 1GB, after which either the write silently failed (in Home Screen web apps) or the user was prompted to raise the quota (in Safari). This flat-limit behavior is superseded on iOS 17+.
- `navigator.storage.estimate()` returns `usage`/`quota` as *estimates* — MDN/community sources note Safari's estimate accuracy has had reported discrepancies (github.com/mdn/content issue #40394) — treat the returned numbers as directional, not exact.

**Spec implication**: for an app storing wardrobe photos (images), the effective ceiling on an installed PWA is generous (60% of device disk, matching Safari itself) rather than the more restrictive allowance a bare WKWebView gets — good news for an image-heavy personal-use app.

---

## Sources

- WebKit blog — Full Third-Party Cookie Blocking and More (2020, ITP 7-day cap + Home Screen exemption): https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- WebKit — Tracking Prevention in WebKit (living reference page, current ITP summary + exemption restated): https://webkit.org/tracking-prevention/
- WebKit Bugzilla #272325 — REGRESSION (iOS 17.x): Session cookies being reset randomly in a Home Screen web app (open/unresolved): https://bugs.webkit.org/show_bug.cgi?id=272325
- WebKit blog — Updates to Storage Policy (2023, origin quota 60%/15%, LRU eviction, standalone-app parity with browser quota): https://webkit.org/blog/14403/updates-to-storage-policy/
- WebKit blog — Workers at Your Service (2018, service worker support introduction, scope, cleanup policy): https://webkit.org/blog/8090/workers-at-your-service/
- WebKit blog — Web Push for Web Apps on iOS and iPadOS (2023, iOS 16.4): https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- WebKit blog — Meet Declarative Web Push (2025): https://webkit.org/blog/16535/meet-declarative-web-push/
- Apple Developer Documentation (archived) — Configuring Web Applications (apple-mobile-web-app-capable, standalone mode, navigator.standalone): https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html/index.html (direct fetch returned HTTP 403 during this research; content corroborated via search-index snippet and consistent secondary quotation)
- MDN — `Window: beforeinstallprompt` event, incl. WICG "Manifest Incubations" spec status and Safari non-support: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event
- MDN — `<input type="file">`, `accept`/`capture` attributes (WHATWG HTML spec): https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file
- Apple Developer Forums thread 65450 — apple-touch-icon sizing discussion (community-corroborated icon size table, not a canonical single Apple spec page): https://developer.apple.com/forums/thread/65450
- Apple Developer Forums — background execution / WebSocket-while-suspended discussion threads (Apple's own forum; DTS-adjacent but not a formal doc page): https://developer.apple.com/forums/thread/716118, https://developer.apple.com/forums/thread/750136
- MDN/community corroboration on external-link-breaks-standalone behavior and iOS file-picker sheet contents (community blog posts, explicitly labeled inferred/community above): gist.github.com/kylebarrow/1042026, developer.chrome.com Lighthouse apple-touch-icon guidance, and general PWA-on-iOS technical write-ups surfaced via search — used only to corroborate points not found stated verbatim in a primary source, and flagged inline as such.
