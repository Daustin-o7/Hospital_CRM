# Go-Live Checklist

Provisional switches that must be settled **before production traffic**. Add an item here every time
code is relaxed for local development.

---

## Security

- [ ] **Mandatory MFA enrolment for privileged roles is switched off in Development.**

  - **What is off:** `Mfa:RequireEnrolment` is `false` in `backend/Hospital_CRM.Api/appsettings.Development.json`.
    While it is false, `ClinicAdmin` / `Owner` / `Doctor` / `Receptionist` / `PlatformAdmin` sessions are issued
    without the `mfa_enrolment_required` claim, so the console does not force `/setup-mfa`, and such a user may
    also switch the second factor off themselves (`POST /auth/mfa/disable`).
  - **Production behaviour:** the key is absent from `appsettings.json`, so `MfaGateOn` defaults to `true`
    (`AuthController`) and `MfaPolicy.RequiresEnrolment` is enforced exactly as specified in Section 0.
  - **Verify before launch:**
    ```bash
    # must print nothing (key only exists in the Development file)
    Select-String -Path backend/Hospital_CRM.Api/appsettings*.json -Pattern "RequireEnrolment"
    # must answer "true" on a production-like host
    curl -s https://<api>/api/v1/auth/login -H "Content-Type: application/json" \
      -d '{"email":"<doctor>","password":"<pw>"}' | grep -o '"mfaEnrolmentRequired":[a-z]*'
    ```
    Also confirm the environment variables `Mfa__RequireEnrolment` / `ASPNETCORE_ENVIRONMENT` are not set to
    `false` / `Development` in the production deployment (docker compose, App Service, etc.).
  - **Risk if missed:** privileged accounts can operate without a second factor — a stolen password is enough
    to move money, write clinical notes, or administer the platform.
