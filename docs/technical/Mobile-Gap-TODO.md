# Mobile gap TODO

Gaps found while verifying the remediation table (`docs/technical/Mobile-Audit-Verification.md`).
Every item has a **Done when** that can be tested; nothing here is "done" without that test passing.

Status: `[ ]` open · `[x]` done · `[~]` accepted risk / not code · `[!]` blocked outside the repo.

## P0 — release blockers

- [x] **G1 — Release build was debug-signed.**
  `signingConfigs.release` silently fell back to `~/.android/debug.keystore`.
  **Done when:** `assembleRelease` without `RELEASE_STORE_FILE`/`RELEASE_STORE_PASSWORD`/`RELEASE_KEY_ALIAS`/
  `RELEASE_KEY_PASSWORD` produces `app-release-unsigned.apk` and prints a warning; with the four values set it
  produces a signed APK and `apksigner verify` reports a V2 signer.
  **Verified:** warning printed twice and only `app-release-unsigned.apk` was produced; with the four values set,
  `app-release.apk` signed and `apksigner verify` printed `V2 Signer: certificate DN: … CN=Android Debug`
  (the debug key was passed explicitly for the local smoke — no fallback is compiled in any more).

- [x] **G2 — R8 shrinking was off.**
  **Done when:** release build has `minifyEnabled true` + `shrinkResources true`, the ProGuard rules keep the
  Capacitor plugin surface, and the release APK installs and launches with the bundled UI.
  **Verified:** 4 MB → 2 MB APK; `com/hospitalcrm/web/PaymentBridgePlugin` is still present, unrenamed, in
  `classes.dex`; the release APK installed, launched and rendered the login screen with no `ClassNotFound`
  or `NoSuchMethod` for our code. A full release login needs an HTTPS API, because G5 now blocks mixed content
  in release builds — that is the intended behaviour, not a regression.

- [x] **G3 — Device pairing and request signing were not wired.**
  **Done when:** a clinic admin generates a code in Settings, a phone pairs with it, the pairing card lists the
  device, the drain posts `X-Device-Id`/`X-Device-Timestamp`/`X-Device-Signature`, the server answers 200, an
  unsigned post from that tenant answers 401, and revoking the device restores the unsigned path.
  **Verified on `emulator-5554`:**
  - before pairing: unsigned POST → `200 {"status":"unmatched"}`
  - Settings → *Generate a code* → `452138`; typed on the phone → *Pair this phone* → card shows
    "This phone signs every signal (device 15d9d2ec…)"
  - unsigned POST from that tenant → `401 {"error":"device_signature_required"}`
  - a real emulator SMS (`adb emu sms send … Rs 250.00 credited … UTR 112233445566`) was parsed, signed
    (`signBody` in logcat) and accepted; the queue cleared
  - revoke → the next drain signed with the dead device, got `unknown_device`, cleared the local credential,
    and the following cycle posted unsigned (`200`) and cleared the queue
  - the stored secret is encrypted at rest (Keystore AES-GCM; the prefs file holds ciphertext only)

## P1 — security and privacy

- [x] **G4 — Offline outbox stored patient names in plain `localStorage`.**
  **Done when:** entries older than 24 h are dropped on read and on login, the outbox is cleared on sign-out,
  and the residual risk is written down.
  **Verified:** `frontend/src/services/offlineOutbox.ts` filters on `createdAt` (24 h) whenever the queue is
  read, `AuthContext.logout` calls `clearOutbox()`, and `Billing.tsx` / `DashboardLayout.tsx` use the shared
  helpers (no more duplicate `JSON.parse` of the raw key). Residual risk: while signed in, a queued invoice
  still holds the patient name in plain text on the device.
  `shortcut: the 24 h TTL is not user-configurable; revisit if clinics keep invoices offline for longer.`

- [x] **G5 — WebView allowed mixed content in every build.**
  **Done when:** `MIXED_CONTENT_ALWAYS_ALLOW` is applied only when `FLAG_DEBUGGABLE` is set.
  **Verified:** `MainActivity` applies it inside the `isDebuggable` branch; the release APK booted and loaded
  the bundled app while HTTPS-only enforcement stays on.

- [x] **G6 — Notification-listener screen may not exist.**
  Plugin falls back to `android.settings.SETTINGS` and the UI reports the failure instead of doing nothing.
  Verified structurally on an image without the listener screen.

## Not code — needs a decision or an asset

- [~] **G7 — `MobileApp/` is outside version control.** Lives at `E:\Company\Hospital Management\MobileApp`,
  one level above the repo, so `git add` cannot reach it. Needs `git init` + a remote (user action) or a move
  inside the repo.
- [!] **G8 — Play Store submission.** Still needs a branded icon/splash (Capacitor defaults), a privacy policy URL,
  the Data safety form, and the `READ_SMS`/`RECEIVE_SMS` declaration with a policy justification.
- [!] **G9 — Push notifications / crash reporting.** No FCM (`google-services.json`) and no crash reporter; both
  need project credentials.

## Verification commands

```bash
# G1/G2 — unsigned (must warn and produce app-release-unsigned.apk)
cd MobileApp/android && ./gradlew :app:assembleRelease

# G1/G2 — signed (supply a real upload key in CI; the debug key is for local smoke only)
RELEASE_STORE_FILE=… RELEASE_STORE_PASSWORD=… RELEASE_KEY_ALIAS=… RELEASE_KEY_PASSWORD=… \
  ./gradlew :app:assembleRelease
$ANDROID_HOME/build-tools/<v>/apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk

# G3
dotnet test tests/Hospital_CRM.Tests        # backend signature tests
adb emu sms send +919876543210 "Rs 500.00 credited to A/c XX1234. UTR 998877665544"
adb logcat -d | grep PaymentBridge          # peek → signBody → clear

# G5/G6
adb install -r app/build/outputs/apk/debug/app-debug.apk && adb logcat -d | grep -i "mixed content"
```
