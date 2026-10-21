# Mobile Push Notifications & Crash Reporting Setup (G9)

This runbook documents the credential setup, dependency configuration, and healthcare data privacy (PHI) hardening required to activate Firebase Cloud Messaging (FCM) and Crash Reporting (Firebase Crashlytics / Sentry) on the SamStack Hospital CRM mobile app.

---

## 1. Push Notifications — Firebase Cloud Messaging (FCM)

### Prerequisites:
- A Firebase Project (e.g., `samstack-hospital-crm`) registered on the [Firebase Console](https://console.firebase.google.com).
- Android package name registered: `com.hospitalcrm.web`.
- SHA-1 and SHA-256 fingerprints from both debug keystore and release upload keystore added to Firebase project settings.

### Setup Steps:
1. Download `google-services.json` from the Firebase Console.
2. Place the file at:
   ```
   MobileApp/android/app/google-services.json
   ```
3. Add the Google Services Gradle plugin to `MobileApp/android/build.gradle`:
   ```groovy
   buildscript {
       dependencies {
           classpath 'com.google.gms:google-services:4.4.2'
       }
   }
   ```
4. Apply the plugin in `MobileApp/android/app/build.gradle`:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```
5. Install and configure `@capacitor/push-notifications`:
   ```bash
   cd MobileApp
   npm install @capacitor/push-notifications
   npx cap sync android
   ```
6. Backend notification dispatch:
   - When appointments or patient tokens update (MOD-08/FR-08), backend calls Firebase Admin SDK / FCM v1 REST API using Google Service Account credentials stored in user-secrets or environment variables (`FIREBASE__SERVICE_ACCOUNT_KEY`).

---

## 2. Crash Reporting — Sentry / Firebase Crashlytics

### Healthcare Privacy / PHI Sanitization Rules (MANDATORY):
Under HIPAA, DPDP, and Hospital CRM architecture rules, **NO Personal Health Information (PHI) or Personally Identifiable Information (PII) may appear in crash reports or stack traces**.

### Sanitization Implementation:
When initializing Sentry (`@sentry/capacitor`) or Crashlytics:
1. **Scrub Request URLs & Query Strings:** Strip patient IDs and phone numbers from request URLs:
   ```typescript
   Sentry.init({
     dsn: process.env.VITE_SENTRY_DSN,
     beforeSend(event) {
       // Scrub patient names and PII from breadcrumbs
       if (event.breadcrumbs) {
         event.breadcrumbs = event.breadcrumbs.map(b => {
           if (b.data) {
             delete b.data.patientName
             delete b.data.phone
             delete b.data.chiefComplaint
             delete b.data.observations
           }
           return b
         })
       }
       return event
     }
   })
   ```
2. **Crashlytics Custom Keys:** Only include operational metadata:
   - `tenant_id`
   - `device_model`, `os_version`
   - `api_base_url`
   - `build_type` (release/debug)
   - NEVER attach patient records, SMS content, or invoice payloads to crash logs.

---

## 3. Required User Inputs / Credentials

To finalize production integration, the following credentials must be generated in Firebase and Sentry:

1. **`google-services.json`** (from Firebase console) placed in `MobileApp/android/app/`.
2. **`VITE_SENTRY_DSN`** (or Crashlytics enabled in Gradle) for telemetry.
3. **`Firebase__ServiceAccountKey`** configured in backend user-secrets for server-side push dispatch.
