# Go-Live Checklist

Provisional switches and database configurations that must be settled **before production traffic**. Add an item here every time code is relaxed for local development or when security policies are enforced.

---

## 1. Security & Authentication

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

---

## 2. Database Governance & Append-Only Grants (FR-08)

- [ ] **Database Role Permissions & Audit Table Immutability:**
  Production database user (`app_user`) must have destructive write actions revoked on all statutory audit tables:
  ```sql
  REVOKE UPDATE, DELETE ON 
    "PatientAuditLogs", 
    "AuthAuditLogs", 
    "DrugStockMovements", 
    "StockMovements", 
    "NurseAuditLogs" 
  FROM app_user;
  ```
  - **Verify before launch:**
    ```sql
    SELECT grantee, table_name, privilege_type 
    FROM information_schema.role_table_grants 
    WHERE table_name IN ('PatientAuditLogs', 'AuthAuditLogs', 'DrugStockMovements', 'NurseAuditLogs')
      AND grantee = 'app_user';
    -- Only INSERT and SELECT should be present; UPDATE and DELETE must NOT exist.
    ```

- [ ] **Production Composite Indexes:**
  Confirm composite indexes are applied to PostgreSQL for low-latency queries during peak OPD volume:
  ```sql
  CREATE INDEX IF NOT EXISTS "IX_Patients_TenantId_Phone" ON "Patients" ("TenantId", "Phone");
  CREATE INDEX IF NOT EXISTS "IX_Appointments_TenantId_DoctorId_Date_Status" ON "Appointments" ("TenantId", "DoctorId", "Date", "Status");
  CREATE INDEX IF NOT EXISTS "IX_DrugBatches_DrugId_ExpiryDate_Remaining" ON "DrugBatches" ("DrugId", "ExpiryDate", "QuantityRemaining");
  CREATE INDEX IF NOT EXISTS "IX_Invoices_TenantId_PatientId_Status" ON "Invoices" ("TenantId", "PatientId", "Status");
  CREATE INDEX IF NOT EXISTS "IX_Consultations_TenantId_PatientId_CreatedAt" ON "Consultations" ("TenantId", "PatientId", "CreatedAt");
  ```

---

## 3. Regulatory Gates (CDSCO Drugs & Cosmetics Act)

- [ ] **Retail Drug Licenses (Form 20 & Form 21):**
  Pharmacy POS dispensary requires active Form 20 (General Drugs) and Form 21 (Biological / Schedule C/C1) licenses configured on the clinic:
  - Verify `Clinics.PharmacyLicenceNumber20` and `Clinics.PharmacyLicenceNumber21` are populated.
  - If missing, POS checkout returns `403 pharmacy_licence_missing`.

---

## 4. Tenancy & Activated Modules

- [ ] **Activated Modules on Tenants & Clinics:**
  Ensure the tenant has all licensed modules activated in `Tenants.ActivatedModules`:
  `core,pharmacy,lab,inventory,finance,wishlist,emergency,precheck,notifications,staff_roster`.
