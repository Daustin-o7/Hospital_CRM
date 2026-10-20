# Mobile Application Audit — Implementation & Gaps

> **Scope:** the Android app at `E:\Company\Hospital Management\MobileApp` (Capacitor 6 shell + React 19 web bundle), and the shared code it depends on (`frontend/src`, `backend/Hospital_CRM.Api`).
> **Reference spec:** `docs/technical/Mobile-Application-Plan.md` (v4.0), `docs/product/FRD_FINAL.md` (FR-01–22), `FRD-Phase-2-FINAL.md`.
> **Audited at:** branch `fix/mobile-app-errors`, HEAD `6047a63` (post-OpenIddict merge).
> **Date:** 2026-10-21.
> **Method:** source read, merged-manifest inspection, shipped-bundle inspection, Gradle build. No physical device or emulator was attached (`adb devices` empty) — every runtime claim below is marked accordingly.

---

## 1. Executive summary

The Android app **builds and runs as a thin Capacitor wrapper around the full web PWA**. There is no native feature layer beyond the B2.9 payment bridge. That is a legitimate architecture choice *if* the wrapper is correctly configured — it is not.

**Verdict: not shippable to a clinic.** Two independent blocking defects:

1. **The app cannot reach the backend on any real device.** The API base URL is hardcoded to `10.0.2.2` (the Android *emulator's* alias for the host machine), and no build-time override is set, so the string is baked into the shipped bundle. There is also no cleartext/certificate configuration, so the dev HTTP endpoint is blocked by the platform and the dev HTTPS certificate is untrusted by the WebView.
2. **The B2.9 payment bridge cannot be switched on from inside the app.** The SMS receiver and the notification listener are both declared correctly, but nothing ever requests `RECEIVE_SMS` and nothing ever opens the notification-access settings screen. Both paths are dead on a fresh install.

Separately, the payments path contains a **money-correctness risk**: the parser treats the word "paid" as a credit signal, and the server auto-closes an invoice on an amount-only match. A debit SMS can therefore close an invoice.

| Severity | Count | Meaning |
|---|---|---|
| Critical | 4 | App unusable / feature unreachable for every user |
| High | 7 | Wrong money, PHI exposure, or unshippable release artefact |
| Medium | 11 | Broken UX, policy risk, or untestable |
| Low | 4 | Hygiene |

**What genuinely works:** Capacitor shell and asset pipeline, the Gradle debug build (4.45 MB APK), the full Phase 1 + Phase 2 UI (same bundle as web, so parity is total by construction), native signal capture → local queue → authenticated upload code path, and the server-side bridge/ sync/ Typesense endpoints.

---

## 2. Evidence collected

| Check | Command / file | Result |
|---|---|---|
| Debug build | `gradlew :app:assembleDebug` | `BUILD SUCCESSFUL in 19s`, APK 4.45 MB |
| Bundle in sync | SHA-256 of `MobileApp/dist/index.html` vs `frontend/dist/index.html` | identical (`8B1316CB…29FD`) |
| Assets synced | `android/app/src/main/assets/public` | synced 00:23:59, matches `dist` |
| Backend alias in bundle | `Select-String dist/assets/*.js '10.0.2.2'` | **found** (`Alert-BMg-YROm.js`) |
| Cleartext policy | merged debug manifest | no `usesCleartextTraffic`, no `networkSecurityConfig`, `targetSdk 34` |
| Device available | `adb devices` | none |
| Native tests | `app/src/test`, `app/src/androidTest` | template tests only (`com.getcapacitor.myapp`) |

---

## 3. Architecture as built

```
┌──────────────────────────────────────────────────────────────────────┐
│ Android app  (com.hospitalcrm.web, versionCode 1, targetSdk 34)      │
│                                                                      │
│  MainActivity ── registers ──► PaymentBridgePlugin (peek / clear)    │
│                                     ▲                                │
│  BankSmsReceiver ──┐                │ SharedPreferences              │
│  (SMS_RECEIVED)    ├─► PaymentSignalParser ─► PaymentBridgeStore     │
│  NotificationListen┘   (regex: amount, UTR, credit-word)  (max 50)   │
│                                                                      │
│  WebView  https://localhost  ── loads bundled dist/ (full React app) │
│     └─ DashboardLayout: drain on mount + every 60 s                 │
│        paymentBridge.ts ─► POST /integrations/payments/bridge/…     │
│                                                                      │
│  axios baseURL = https://10.0.2.2:7001/api/v1   ← hardcoded          │
└──────────────────────────────────────────────────────────────────────┘
                              │ (no route to host on a real phone)
                              ▼
             .NET 10 API  /  PostgreSQL 16  (shared with web)
```

**Auth (as shipped):** password form → `POST /auth/login`; access token in memory, refresh token in `sessionStorage`. The OIDC path (`oidc-client-ts`) exists but is disabled because the mobile build sets no `VITE_AUTH_AUTHORITY` / `VITE_AUTH_CLIENT_ID`, so `isOidcConfigured` is false.

**Wrapper hygiene:** `MobileApp/` has no `src/` — `dist/` is a copy of the frontend build. `package.json` nonetheless declares `react`, `axios`, `zustand`, `typescript`, and a `tsconfig.json` that compiles nothing (42.8 MB of `node_modules`).

---

## 4. Implementation scorecard

| Area | Status | Evidence |
|---|---|---|
| Capacitor shell / asset pipeline | ✅ Working | `capacitor.config.json`, `MainActivity.java`, assets synced |
| Debug build | ✅ Working | Gradle `BUILD SUCCESSFUL`, 4.45 MB APK |
| Feature parity with web | ✅ Total (same bundle) | `dist` == `frontend/dist` |
| Backend connectivity | ❌ Broken on device | `api.ts:12-17` + baked bundle |
| Domain auth (password login) | ⚠️ Works, no persistence | `sessionStorage` refresh token |
| OIDC / SSO | ⚠️ Present, unconfigured, untested | `oidc.ts`, no `VITE_AUTH_*` |
| B2.9 SMS capture | ⚠️ Code complete, **cannot be granted** | `AndroidManifest.xml:69`, no runtime request |
| B2.9 notification capture | ⚠️ Code complete, **cannot be enabled in-app** | `PaymentNotificationListenerService.java:11-13` |
| Bridge upload / dedupe | ✅ Implemented | `paymentBridge.ts`, `PaymentIntegrationsController.cs:243-293` |
| Offline (FR-22) | ❌ UI lies on failure | `Billing.tsx:146`, `ReceptionistDashboard.tsx:164` |
| Bluetooth ESC/POS print | ❌ Absent | only `window.print()` (`PharmacyPOS.tsx:373`) |
| QR / token camera scan | ❌ Absent | `CAMERA` permission unused |
| Push notifications | ❌ Absent | no `google-services.json`, no FCM plugin |
| PIN quick-switch / idle lock | ❌ Absent | no implementation in `frontend/src` |
| Release readiness | ❌ Not started | no signing config, default Capacitor icon/splash |
| Automated tests | ❌ Absent | template tests; Maestro asserts nothing |

---

## 5. Findings

### Critical

**C1 — API base URL is hardcoded to the emulator loopback alias.**
`frontend/src/services/api.ts:12-17` returns `http://10.0.2.2:5000/api/v1` (or `https://10.0.2.2:7001`) whenever a Capacitor platform is detected. `VITE_API_BASE_URL` is the only escape hatch and the mobile build script (`MobileApp/package.json:6`) never sets it, so the alias is compiled into `dist/assets/*.js` (verified). On a phone, `10.0.2.2` is not a routable address — login fails for every user, on every clinic network.
*Fix:* require `VITE_API_BASE_URL` at build time (fail the build if missing), with per-environment `.env` files.

**C2 — No transport configuration: cleartext blocked, dev certificate untrusted.**
`targetSdk = 34` (`android/variables.gradle`); the merged manifest has no `android:usesCleartextTraffic` and no `networkSecurityConfig`. Android blocks cleartext HTTP for targetSdk ≥ 28, so `http://10.0.2.2:5000` fails with `ERR_CLEARTEXT_NOT_PERMITTED`. Capacitor's default scheme is `https`, so the app actually requests `https://10.0.2.2:7001`, where ASP.NET's self-signed dev certificate is rejected by the WebView (`ERR_CERT_AUTHORITY_INVALID`). Even the emulator path only works after manually installing the dev CA.
*Fix:* production must be HTTPS with a public CA and no cleartext; a `network-security-config` scoped to `debug` may allow the dev host only.

**C3 — `RECEIVE_SMS` is declared but never requested.**
`AndroidManifest.xml:69` declares it; `BankSmsReceiver.java:12` documents that "the user grants it explicitly". A repository-wide search for `requestPermission` / `checkSelfPermission` / `requestPermissions` returns **zero** call sites, and no Capacitor permission plugin is installed. On Android 6+ the receiver never receives an SMS, so the entire SMS fallback is dead code in production.

**C4 — Notification access is never requested or explained.**
`PaymentNotificationListenerService.java:11-13` assumes the user finds *Settings → Notification access* unaided. No screen links to `ACTION_NOTIFICATION_LISTENER_SETTINGS`, and there is no status indicator. Combined with C3, the soundbox path is also unreachable, which is exactly why B2.9 has never been proven on a device.

### High

**H1 — The bridge has no enrolment UX at all.** No settings screen shows permission state, no enable/disable toggle, no "signals captured / last upload" feedback. The only bridge UI is a background loop in `DashboardLayout.tsx:277-281`. Even after C3/C4 are fixed, support staff cannot diagnose a silent device.

**H2 — There is no release artefact.** `android/app/build.gradle` has no `signingConfigs`; only `assembleDebug` exists. `versionCode 1 / versionName "1.0"`, package `com.hospitalcrm.web`, and the launcher icon and splash are the **stock Capacitor logo** (verified visually at `mipmap-xxxhdpi/ic_launcher.png`, `drawable/splash.png`). No AAB, no Play metadata, no privacy policy link.

**H3 — Raw bank SMS is stored unencrypted and is eligible for cloud backup.**
`PaymentBridgeStore.java:17-34` writes plain JSON into `MODE_PRIVATE` SharedPreferences (up to 50 signals, each with up to 500 chars of raw SMS text). `AndroidManifest.xml:5` sets `android:allowBackup="true"`, so those messages are eligible for Google backup. The server then persists the same text as `RawPayload` (up to 4000 chars) at `PaymentIntegrationsController.cs:274`. A bank SMS can contain account suffixes, balances and UTRs.
*Fix:* `allowBackup=false` (or `dataExtractionRules` excluding the prefs file), encrypt the queue, and stop persisting `rawText` server-side (store a hash + amount + UTR only).

**H4 — "paid" is treated as a credit keyword, and matching is amount-only.**
`PaymentSignalParser.java:37-39` accepts `credited | received | paid | deposited`. A UPI **debit** SMS such as "You have paid Rs.500 to …" passes the credit check. The server then calls `MatchInvoiceAsync` (`PaymentIntegrationsController.cs:434-465`), which matches on exact amount plus a 7-day window and, when exactly one invoice matches, calls `CloseInvoice` → invoice marked `Paid`, payment recorded. No human review. A debit of a common amount can close an unrelated invoice.
*Fix:* drop `paid`; require a credit verb *and* either a reference containing the invoice number or a UTR before auto-closing; route amount-only matches to the existing unmatched/review queue.

**H5 — The bridge trusts a device-reported amount with no device credential.**
`[AuthorizeRoles("ClinicAdmin","Receptionist")]` plus the JWT is the only control (`PaymentIntegrationsController.cs:243-245`, documented as intentional). Any receptionist can `POST` `{eventId: random, amount: X}` and close an invoice without money moving. Manual cash entry is also possible, but that is an explicit, visible action; a forged "UPI" payment with a fabricated UTR looks like a verified receipt. `CloseInvoice` writes no audit entry either; the only trace is `ProcessedWebhookEvent.Provider = "bridge:sms"`.
*Fix:* per-device enrolment secret (HMAC or device token), and a `verified` flag on bridge-sourced payments that a human must confirm, plus an audit entry.

**H6 — The "offline" fallbacks in the shared bundle lie to the user.**
`Billing.tsx:146` posts to `/sync/push`; the `catch` at `:151-166` fabricates an invoice number, prepends it to local React state, shows "Invoice generated", and never retries or persists. Reload → invoice gone, nothing billed. `ReceptionistDashboard.tsx:164` does the same for check-in. In a clinic this is the worst place for a silent failure, and the mobile app is the most likely client to hit it.
*Fix:* queue to durable storage (IndexedDB/localStorage) with an explicit "pending sync" badge, or surface the error. FR-22 requires the former.

**H7 — The money path has no tests, and the E2E suite asserts nothing.**
`PaymentSignalParser` (regex, amounts, UTR, dedupe) has no unit tests; the only tests are the Capacitor template stubs. All 22 `.maestro/*.yaml` flows mark every `tapOn`/`assertVisible` `optional: true`, so a flow passes on a blank screen, and none covers the bridge, permissions, or a failure path.

### Medium

**M1 — Every non-billing role fires a 403 every minute.** `DashboardLayout.tsx:277-281` drains for any authenticated user, but the endpoint allows `ClinicAdmin` and `Receptionist` only. Doctors, nurses and pharmacists therefore POST a 403 on mount and every 60 s, and the queue never clears on their devices.

**M2 — Dedupe key collides on identical notifications.** `eventId = sha256(source|text)` (`PaymentSignalParser.java:44`) has no timestamp or notification id. Two genuine ₹500 payments producing identical text collapse into one; the second is dropped as a duplicate.

**M3 — The notification listener accepts any app's notifications.** `PaymentNotificationListenerService.java:29-31` looks at every posted notification and keeps anything with a credit word and an amount. Marketing notifications ("₹500 cashback credited") become review-queue noise.

**M4 — No push notifications.** No `google-services.json`, no FCM plugin (`build.gradle` logs that push will not work). Plan §2.1 and the "Background Alerts" box are unimplemented.

**M5 — No staff PIN quick-switch or idle lock.** Plan §5.4 (4-digit PIN, 5 attempts, 15-minute lockout, 15-minute idle return) is absent from `frontend/src`.

**M6 — No Bluetooth ESC/POS printing.** Plan §5.1 is unimplemented; the only print path is `window.print()` in `PharmacyPOS.tsx:373`. `BLUETOOTH*` permissions are declared but unused, which is both dead weight and a Play review question.

**M7 — No QR/token camera scanner.** Plan §5.3 absent; `CAMERA` is declared but unused.

**M8 — `MobileApp/` is outside version control, and its build is hand-wired.** `git rev-parse` fails: no history, no CI, no review. The APK build does not run the frontend build or `cap sync` first, so `assembleDebug` can package whatever `assets/public` happens to contain. The `test:mobile` script points at `.maestro/app-launch.yaml`, which does not exist (the flow is `01-app-launch-and-branding.yaml`), so that command fails immediately.

**M9 — The wrapper carries deps it never uses.** `react`, `axios`, `zustand`, `typescript` and `tsconfig.json` with no `src/` — 42.8 MB of `node_modules` for a shell that only copies files.

**M10 — No operational or PHI-hardening controls.** No crash reporting/telemetry, no `FLAG_SECURE` (patient data appears in the recents thumbnail and can be screenshotted), no app-lock/timeout, no root/tamper detection.

**M11 — SSO is unconfigured and untested on device.** `oidc.ts` falls back to the WebView origin and `/auth/callback`; the mobile build sets no `VITE_AUTH_*`, so the SSO button is hidden and only the password form works. There is no custom-scheme intent filter, so an external-IdP redirect strategy would need one.

### Low

- **L1** `versionCode`/`versionName` are static; no release notes or migration policy.
- **L2** No README for `MobileApp/`; `Mobile-Application-Plan.md` is stale (still says Azure Entra External ID, "Pharmacist deferred", Phase 1 only) while Phase 2 modules ship in the same bundle.
- **L3** iOS target absent (`android/` only). Acceptable if Android-only is a decision, but it should be recorded.
- **L4** No certificate pinning. Acceptable for now; revisit once the API host is fixed and production TLS is in place.

---

## 6. Gap register vs `Mobile-Application-Plan.md`

| Plan item | Status | Evidence |
|---|---|---|
| §1.2 Step 0 PWA validation on 2–3 devices | ❓ No record | no artefact in repo; the gate is a precondition, so this is a process gap |
| §3 Typesense patient search via gateway | ✅ Server side | `PatientsController` + `Services/Typesense`; client uses the same endpoint |
| §3.5 Nightly reindex | ✅ Server side | reindex job referenced in `PatientsController.cs:90` |
| §4.3 Drug LRU cache (<500 KB) | ❌ Not implemented | no local medicine cache in `frontend/src` |
| §5.1 Bluetooth ESC/POS printing | ❌ | `window.print()` only |
| §5.2 Aadhaar RD Service | ⏸ Correctly deferred | no code present |
| §5.3 Camera QR/token scanner | ❌ | `CAMERA` unused |
| §5.4 PIN quick-switch + FR-01 lockout | ❌ | no implementation |
| §6 FR-22 SQLite outbox | ⚠️ Partial | server `/sync/push` exists (`SyncController`), client sends one-shot and fakes success on failure |
| §7 FR-01–22 mobile matrix | ⚠️ UI present, native/perf claims unverified | same bundle as web |
| §8 `/api/v1/sync/push` contract | ✅ Implemented | `SyncController.Push` |
| §9.1 SLA targets (cold start, print, flush) | ❓ Never measured | no device runs |

---

## 7. Verified vs unverified

**Verified:** build succeeds; APK produced; manifest/permissions as described; bundle contents (including the `10.0.2.2` alias); asset sync; source behaviour of parser, store, receiver, listener, plugin, drain loop, bridge endpoint, invoice matcher; all UI files referenced exist.

**Unverified (no device/emulator):** actual login, actual SMS receipt, actual soundbox notification, notification-access flow, upload/dedupe on device, cold-start time, print behaviour, Android WebView cookie behaviour for the OIDC redirect, and Play policy outcomes.

---

## 8. Release-readiness checklist (Google Play)

| Item | State |
|---|---|
| Reachable HTTPS API, no cleartext | ❌ C1, C2 |
| Signed AAB, keystore custody | ❌ H2 |
| Branded icon + splash | ❌ H2 |
| Versioning / release notes | ❌ L1 |
| Privacy policy + Data safety form | ❌ not present |
| SMS permission declaration (`RECEIVE_SMS`) | ❌ likely rejection — Google restricts SMS to default handlers / narrow exceptions. Needs a declaration form, or the SMS path must be dropped in favour of the PSP webhook / soundbox |
| Notification-listener disclosure | ❌ not present |
| `FLAG_SECURE` for PHI | ❌ M10 |
| Crash reporting | ❌ M10 |
| Tested on a physical device | ❌ never |
| Automated tests | ❌ H7 |

---

## 9. Prioritised remediation

**P0 — blocking (must precede any pilot)**
1. Build-time `VITE_API_BASE_URL`, HTTPS-only production, debug-only network-security config (C1, C2).
2. In-app permission flow for SMS + notification access, with live status (C3, C4, H1).
3. Fix the credit-keyword set and require a reference/UTR before auto-closing; otherwise queue for review (H4).
4. `allowBackup=false` + encrypted queue + drop `rawText` server-side (H3).
5. Make the offline path durable, or fail loudly (H6).

**P1 — before a Play submission**
6. Signing config, AAB, versionCode policy, branded icon/splash, privacy policy, Data safety + SMS declaration (H2).
7. Unit tests for `PaymentSignalParser`; Maestro flows with real assertions including a bridge case (H7).
8. Restrict the drain to `ClinicAdmin`/`Receptionist` (M1).
9. Decide the SMS strategy with Play policy in mind; soundbox-only may be the viable path (M6-adjacent policy risk).
10. Per-device bridge credential + audit entry (H5).

**P2 — product completeness**
11. Real offline outbox (FR-22), push/FCM, PIN quick-switch, Bluetooth ESC/POS, QR scanner (M4, M5, M6, M7, §6).
12. Crash reporting, `FLAG_SECURE`, app lock, certificate pinning (M10, L4).
13. Move `MobileApp/` into version control and wire `cap sync` into the Gradle build (M8).
14. Remove unused deps and `tsconfig.json` (M9).
15. Update the plan doc to match Phase 2 reality and the in-house OpenIddict identity (L2).

---

## 10. Decisions needed

1. **Distribution:** Play Store, MDM/sideload, or PWA-only? The SMS permission alone makes Play distribution a policy fight.
2. **Bridge status:** supported product feature, or a pilot workaround until PSP webhooks (B4) exist? That answer decides how much of P0 is worth building.
3. **Offline:** is FR-22 a real mobile requirement, or web-only? The plan promises SQLite outbox; the code has neither.
4. **Android-only** for v1 — confirm and record (L3).
5. **Keystore custody** and who signs releases (H2).

---

## Appendix — file inventory

```
MobileApp/
  capacitor.config.json                     appId com.hospitalcrm.web, webDir dist
  package.json                              build copies frontend/dist then cap sync
  android/app/build.gradle                  versionCode 1, no signingConfigs
  android/variables.gradle                  minSdk 24 / target 34
  android/app/src/main/AndroidManifest.xml  SMS receiver, listener service, unused BT/CAMERA
  .../java/com/hospitalcrm/web/
      MainActivity.java                     registers PaymentBridgePlugin
      BankSmsReceiver.java                  SMS_RECEIVED → parser → store
      PaymentNotificationListenerService.java  all notifications → parser → store
      PaymentSignalParser.java              credit word + amount + UTR + sha256 eventId
      PaymentBridgeStore.java               plaintext SharedPreferences, max 50
      PaymentBridgePlugin.java              peek() / clear()
  .maestro/*.yaml                           22 screenshot smoke flows, all optional
```

Shared code: `frontend/src/services/api.ts` (base URL), `frontend/src/services/paymentBridge.ts` (drain), `frontend/src/components/DashboardLayout.tsx:277-281` (60 s loop), `backend/.../PaymentIntegrationsController.cs:243-317` (bridge endpoint + CloseInvoice), `backend/.../SyncController.cs` (FR-22 push).

*This report changes no code.*
