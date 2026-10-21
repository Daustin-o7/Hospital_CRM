# Mobile audit — independent verification of the remediation table

Checked against the working tree on branch `feat/payment-bridge-device-enrolment`, 21 Oct 2026.
Each row is what the code actually does, not what the remediation table says it does.
Verdicts: **Verified** (works, evidence below) · **Fixed** (claim was wrong or incomplete, now corrected) · **Open** (not done).

| ID | Verdict | What the code does | Evidence |
|----|---------|--------------------|----------|
| C1 | **Fixed** | `resolveApiBaseUrl()` in `api.ts`: `VITE_API_BASE_URL` → `localStorage` → Capacitor default `http://10.0.2.2:5000/api/v1` → `/api/v1`. The saved URL only takes effect after a reload, which the settings card does. | Live login through the bundled app against `localhost:5000`. A wrong password returned `invalid_credentials`, so the request reached the API. |
| C2 | **Fixed** | `network_security_config.xml` allows cleartext for `10.0.2.2`, `localhost`, `127.0.0.1` only; WebView set to `MIXED_CONTENT_ALWAYS_ALLOW`. | Same live login over `http://` from `https://localhost`. |
| C3, C4, H1 | **Verified** | `PaymentBridgePlugin.getStatus / requestSms / openNotificationSettings`; card shows live chips, "Grant SMS Permission" and "Configure in Settings". | Emulator, fresh install with `RECEIVE_SMS` denied: in-app CTA raised the Android permission dialog, the grant was accepted, and `dumpsys package` flipped from `granted=false` to `granted=true` without any `adb` helper. The card then read **Permission Granted** back from `getStatus`. |
| H3 | **Verified** | `android:allowBackup="false"`. | Merged manifest. |
| H4 | **Verified** | Rupee as `\u20B9`, explicit credit verbs (`credited`, `received`, `deposited`, `paid by`), debit words rejected. Server re-checks with `IsDebitOnly`. | 6 JUnit tests + 10 live endpoint checks (signed debit body returned `{"status":"ignored"}`). |
| H6 | **Fixed** | Durable `hospital_crm_offline_outbox`, flushed on mount and on `online`. | Code path in `Billing.tsx` / `DashboardLayout.tsx`. |
| H7 | **Fixed** | `PaymentSignalParserTest` (6 tests) and assertions in `.maestro/app-launch.yaml`. | `gradlew :app:testDebugUnitTest` green; Maestro flow green. |
| M1 | **Verified** | Drain runs only for `clinicadmin` / `receptionist`. | `DashboardLayout.tsx` role gate. |
| M8 | **Verified** | `npm run build` = frontend build → copy `dist` → `cap sync`; `test:mobile`, `test:maestro`. | `package.json`; chain ran end to end. |
| M10 | **Verified** | `FLAG_SECURE` only when `!isDebuggable`; WebView debugging only in debug. | `MainActivity.java`. |

## Corrections to the remediation table

1. **C1 was unreachable on a real device.** The only URL override lived in Settings, which is behind
   the login wall. A fresh install on a clinic tablet defaulted to the emulator alias and could never
   sign in. Added `frontend/src/components/ServerAddress.tsx`, rendered on the login screen when
   running natively.
2. **C2: `android:usesCleartextTraffic="true"` was removed.** A global switch overrides the scoped
   network-security config and allows cleartext to *any* host. The domain-scoped config alone is
   sufficient and was verified.
3. **C3/C4/H1: there is no `@Permission(alias = "sms")` annotation.** The plugin uses
   `ActivityCompat.requestPermissions` + `handleRequestPermissionsResult`, which is the same runtime
   contract. The table's mechanism description is wrong, the behaviour is right.
4. **C4: the listener screen may not exist.** On `Medium_Phone_API_36`,
   `android.settings.NOTIFICATION_LISTENER_SETTINGS` resolves to nothing, so the intent threw and the
   button did nothing (the rejected promise was unhandled). Added a fallback to `ACTION_SETTINGS` and
   an error toast. The listener itself could not be exercised on that image because the screen is absent.
5. **H4: no UTF-8 BOM stripping exists** and none is needed — no pattern is anchored to the start of
   the string. Added `withdrawn`, `deducted`, `sent to` to the device filter so it matches the server.
   The device also stops uploading the full SMS text (`rawText`); only the 200-char `reference` is sent.
6. **H6: the "pending sync badge" did not exist.** Added a `N pending sync` chip in the Billing header,
   refreshed when an invoice is queued and when the browser comes back online. The expense path also
   invented a ledger row on failure and reported success — it now reports the error instead, because
   expenses have no offline sync type.
7. **H7: the delivered Maestro flow did not pass.** It raced the cold start and typed into a field that
   was not focused (`ddoctor@…`). Fixed with an explicit wait, `eraseText`, and Enter-to-submit.
8. **M10:** debug builds still allow screenshots and recents thumbnails. That is deliberate (and
   required by the Maestro flows), but it means PHI is visible on any debug build handed to staff.

## Issues found in this pass (not in the table)

| Severity | Issue | Action |
|----------|-------|--------|
| High | The PWA service worker was registered inside the Capacitor shell and threw `Failed to register a ServiceWorker … unknown error when fetching sw.js` on every boot. | Fixed: `injectRegister: false` in `vite.config.ts`, guarded manual registration in `main.tsx` (web only). Logcat is clean. |
| High (release gate) | `assembleRelease` uses `minifyEnabled false` and silently falls back to the **debug keystore** when `RELEASE_STORE_*` is absent. A release APK built that way is debug-signed and cannot be uploaded to Play; the table's "R8 shrinking / production ready" claim is inaccurate. | Open — require `RELEASE_STORE_FILE` for release builds and enable R8 before any store upload. |
| High | Device pairing UI and request signing are not wired, so the backend's per-device HMAC is dormant. | Open — contract in `docs/technical/Payment-Bridge-Device-Enrolment.md`. Do not pair a phone until the client signs. |
| Medium | The offline outbox stores patient names and amounts in plain `localStorage`. | Open — encrypt or drop the patient name once the outbox is final. |
| Low | `MIXED_CONTENT_ALWAYS_ALLOW` is app-wide in the WebView. | Open — remove when the API is served over HTTPS. |
| Low | A cold start with cleared state re-extracts the web assets and can ANR on a loaded emulator (seen once). Relaunch was clean. | Open — informational; the Maestro timeout was raised to 120 s. |

## Emulator run (`Medium_Phone_API_36`)

- `assembleDebug` + `installDebug` succeeded; `lintDebug` 0 errors (17 benign warnings).
- `npm run test:mobile` green: launch → branding assertions → login as `doctor@samstack.ai` → dashboard.
- Settings → Android Native Hardware Bridge: card renders, SMS state read from the OS, permission CTA
  present, server-address override present.
- `dotnet test`: 207 passed (includes 7 device-signature tests from the bridge signing work).
