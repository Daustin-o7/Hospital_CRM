# Master Action Plan & TODO List — Hospital_CRM

> **Active Working Branch:** `feat/security-hardening`  
> **Target Release:** Phase 1 (FR-01–22) + Phase 2 (9 Modules) Hardening & Production Pilot  
> **Security Baseline:** OWASP Top 10 (2021) + DPDP Act Compliance + Least Privilege RBAC  

---

## 🛡️ Recent Fixes Verified & Merged (`ce53300`)
- [x] **Loopback Rate-Limiting Bypass**: Restored throttling for traffic arriving via reverse proxies; loopback no-limiter is now strictly gated on `app.Environment.IsDevelopment()`.
- [x] **Brute-Force Lockout Defense**: `AuthController.Login` now increments `FailedLoginCount`, checks lockout *before* password verification, and locks account for 15 minutes after 5 consecutive failures (`Auth:MaxFailedAttempts = 5`, `Auth:LockoutMinutes = 15`).
- [x] **API Registration Hygiene**: Removed duplicate `AddOpenApi()` registration in `Program.cs`.
- [x] **Branch Architecture**: Merged `feat/nurse-management` into `main` (`ce53300`); created and checked out `feat/security-hardening`.

---

## 🏥 Section 4: Pharmacy (4A) & External Prescription (4B) [SHIPPED ✅]
> Complete tracker: `docs/product/SECTION-4-TODO.md`
- [x] **4.1 CDCI & TrueMD Three-Layer Catalogue**: Flat-file CDCI integration (`GenericMaster`, `BrandMaster`) with checkpoint badge (*"Open Source - Needs Pharmacist Review"*) and search miss logging (`MedicineSearchMissLogs`).
- [x] **4.2 Append-Only Stock Movement Ledger**: `DrugStockMovement` ledger with `CHECK ("QuantityRemaining" >= 0)` and row-locking on dispense.
- [x] **4.3 Stock-In Purchase Entry**: Supplier, licence numbers, invoice #, batch, expiry, MRP, purchase rate, pack size via `POST /api/v1/pharmacy/stock-in`.
- [x] **4.4 Same-Generic Substitution**: Suggest identical generic+strength+form; final decision by user; audit prescribed vs dispensed + `SubstitutionReason`.
- [x] **4.5 Schedule H1 Inspection Register**: Auto-generated immutable supply log, exportable for 3-year statutory compliance inspections.
- [x] **4.6 Retail License & Registered Pharmacist Gate**: Gated on Form 20/21 licence on `Clinic` and registered pharmacist role.
- [x] **4.7 NDPS Digital Prohibition**: Hard block on electronic dispensing of narcotic drugs (`ndps_digital_dispensing_prohibited`).
- [x] **4.8 Sequential Pharmacy Invoicing**: `PHARM-YYYY-XXXXXX` series and reverse MRP-inclusive GST calculation.
- [x] **4.9 Loose Units, Expiry & Batch Recall**: Base unit tablets, expired batch blocks, near-expiry warnings, batch recall flags (`POST /api/v1/pharmacy/batches/{id}/recall`).
- [x] **4.10 Finalized Rx Gate & Least Privilege**: Restrict dispense to finalized consultations; lock dispensed prescription items against silent amendment.
- [x] **4.11 Server-Side Print Payload & Duplicate Reprints**: `GET /api/v1/prescriptions/{id}/print` returns the printable payload (no PDF renderer yet) with watermarked `DUPLICATE COPY` and `PrescriptionPrintLogs` audit trail.
- [x] **4.12 Public QR Verification**: Dedicated `frontend/src/pages/VerifyRx.tsx` with per-version superseded detection (only older printed copies) and expiring HMAC-signed share links.

> Re-verified 2026-10-26: verify/version semantics, dispense matching + NDPS from the stored line, POS MRP/GST as server truth, recall stock zeroing, ledger FK `Restrict` + DB role revokes, module gates on all four pharmacy controllers. Known limits: no PDF/QR image, no pharmacy UI, Rx dispense is not billed. See `docs/SESSION-LOG.md`.

---

## 💳 Section 5: Billing, Payments & Financial Ledger [SHIPPED ✅]
> Complete tracker: `docs/product/SECTION-5-TODO.md`
- [x] **5.1 Statutory Tax**: Exempt/Bill of Supply default (SAC 999312), per-line taxable GST, mixed bill becomes a Tax Invoice, client cannot zero-rate a taxable line.
- [x] **5.2 Finalization**: Draft → Finalized, gapless `MAX+1` numbering, unique DB index, immutable totals, ledger postings that balance (including discount).
- [x] **5.3 Credit Notes**: Finalized-only, `CN-YYYY-XXXXXX` sequence, cumulative cap at invoice total, append-only reversal.
- [x] **5.4 Direct Payments**: Dynamic NPCI UPI QR with primary/backup toggle, cash/card/NEFT, split payments, projected UTR threshold.
- [x] **5.5 Verification**: Reported (hint) vs Confirmed (financial truth); double-confirm and over-balance rejected; idempotent retries.
- [x] **5.6 Payee Security**: ClinicAdmin-only, password + MFA step-up, 24h cooling-off, admin email alerts, priority guard.
- [x] **5.7 Append-Only Ledger**: RBAC revokes for ledger/print/credit notes, EF guard, webhook posting, tender/aging/journal reports.
- [x] **5.8 PWA**: `Billing.tsx` tabs, QR modal, print modal, credit-note modal.

> Re-verified 2026-10-26: double-confirm/overpay, legacy collect ledger, discount-balanced finalize, credit-note caps, invoice-number unique index, webhook fail-loud, tax downgrade, draft print, payee MFA/alerts, ledger GST/reported/net. Known limits: no PDF, deposits, refunds, dual-approval threshold, reported-payment caps/alerts, payee daily limit, statement import. See `docs/SESSION-LOG.md`.

---

## 🔒 Hardening & Release Queue (`feat/security-hardening`)

### P1 Money & Compliance
- [x] **1. Invoice and credit-note numbering**: Indian FY (Apr-Mar, e.g. `2026-27`) series reset on April 1, gapless sequential numbering, unique per tenant+series+FY index in DB.
- [x] **2. Refunds**: Reversal entries, dual approval above a clinic-set threshold, refund reference recorded.
- [x] **3. Reported-payment controls**: Cap on total reported-unconfirmed per clinic; alert when one staff member's confirmations spike; enforce payee daily limit in primary/backup selection.
- [x] **4. Deposits/advances**: Recorded against patient, applied at invoicing, shown on ledger.
- [x] **5. Link pharmacy dispense to billing**: PHARM invoice appears as a linked document (own series, not merged), payable through the same confirm flow.
- [x] **6. Data licences**: Read CDCI License.txt; check TrueMD provenance/licence. Drop TrueMD if unclear. Log result in OPEN-QUESTIONS.md.

### P2 Gaps
- [ ] **7. Server-side PDF**: For invoices, credit notes and prescriptions from finalized versions only; real QR image on Rx.
- [ ] **8. Minimal pharmacy UI**: Dispense, stock-in, H1 export, recall.

### P3 Release Gating
- [ ] **9. Task 1.4**: docker compose up end to end; fix what breaks.
- [ ] **10. Task 3.1**: GitHub Actions (format, lint, build, tests, Playwright, secret scan, vulnerable-package check).
- [ ] **11. Task 3.2**: Serilog correlation IDs, /health/live and /health/ready (DB + storage), backup script and a tested restore.
- [ ] **12. Task 2.3**: FRD walkthrough as one table (requirement | evidence/test | status). Fix only Must-level gaps.

### P4 Prep Only
- [ ] **13. Security Pentest Scope**: Write `docs/security/PENTEST-SCOPE.md` from TODO 3.3 plus surfaces touched.

---

## Phase 0: Security & Hardening (🔴 Blocking — Current Sprint)

Target: Close all Critical, High, and Medium vulnerabilities identified in the OWASP security audit.

- [x] **0.1 [CRITICAL — A02] Rotate JWT Key Pair & Purge Git History**
  - **Issue**: `backend/Hospital_CRM.Api/keys/jwt-private.pem` was committed and pushed to remote git history.
  - **Implementation**:
    1. Purged `jwt-private.pem` across all commits and branches using `git-filter-repo`. Verified zero occurrences remain in git log graph.
    2. Restored clean `origin` remote.
    3. Added session revocation in `scripts/setup-least-privilege-db.sql` (`UPDATE "RefreshTokens" SET "RevokedAt" = NOW()`).
    4. Auto-generation on first run in `PemFileKeyService` safely creates fresh 2048-bit RS256 keypairs on startup when unprovisioned.


- [x] **0.2 [HIGH — A01/A09] Enforce Database-Level Least Privilege (`app_user`)**
  - **Issue**: `appsettings.json` connects as superuser `Username=postgres`. Superusers bypass table-level `REVOKE UPDATE, DELETE`, rendering audit append-only protections ineffective.
  - **Implementation**:
    1. Created `scripts/setup-least-privilege-db.sql` provisioning `app_user` with LOGIN and least-privilege CRUD on public schema tables and sequences.
    2. Re-asserted table-level `REVOKE UPDATE, DELETE` across all 7 audit log tables (`PatientAuditLogs`, `NurseAuditLogs`, `NotificationLogs`, `PriorityLogs`, `ImpersonationLogs`, `AppointmentHistories`, `ControlledSubstanceRegisters`).

- [x] **0.3 [HIGH — Secret Management] Remove Plaintext Secrets & Complete `.env.example`**
  - **Issue**: Plaintext database credentials (`postgres/postgres`) and stub secrets present in tracked configs.
  - **Implementation**:
    1. Removed misleading legacy HMAC key from `appsettings.Development.json`.
    2. Fully populated `.env.example` with reference configuration for database least privilege, Hangfire, Azure Key Vault, Razorpay, WhatsApp, Typesense, and rate limiting.

- [x] **0.4 [HIGH — A07] Prevent User Enumeration on Lockout Response**
  - **Issue**: HTTP 423 `account_locked` response informs an attacker that the username/email exists in the database.
  - **Implementation**: Standardized `AuthController.Login` to return generic HTTP 401 `invalid_credentials` for locked accounts, eliminating username enumeration.

- [x] **0.5 [MEDIUM — A06] Vulnerability Remediation in Nuget Packages**
  - **Issue**: `System.Security.Cryptography.Pkcs` 9.0.0 is flagged with GHSA-2fmv-rv2c-59x7 (NU1902).
  - **Implementation**: Upgraded `System.Security.Cryptography.Pkcs` and `System.Security.Cryptography.Xml` to `10.0.13` in `Hospital_CRM.Api.csproj` and `Hospital_CRM.Infrastructure.csproj`. NU1902 warning is completely eliminated.

- [x] **0.6 [MEDIUM — A02/A05] JWT Algorithm Pinning & Production Cookie Security**
  - **Implementation**:
    1. Pinned `ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 }` in `Program.cs` and `JwtBearerOptionsConfig.cs`.
    2. Configured ASP.NET Core `UseForwardedHeaders` (XForwardedFor | XForwardedProto) in `Program.cs`.
    3. Enforced `Secure = !_env.IsDevelopment() || Request.IsHttps` on refresh token cookies across login, refresh, and logout.

---

## Phase 1: End-to-End Verification & Dev Tooling

Target: Establish reproducible test gates and prevent environment crashes or orphaned processes.

- [x] **1.1 Execute Automated Test Suites End-to-End**
  - Backend unit & integration test suite (`dotnet test tests/Hospital_CRM.Tests`): **38 passed, 0 failed, 0 skipped**.
  - Frontend TypeScript & bundle verification (`npm run build`): **exited with code 0**.
  - Frontend static lint (`npm run lint`): **0 errors**.

- [x] **1.2 Add CI Graceful-Shutdown & Process-Leak Assertion**
  - Implemented `scripts/check-process-leaks.ps1` to detect lingering `node` or `dotnet` listeners on ports 5000, 7001, and 5173.

- [x] **1.3 Create Standardized Local Dev Start/Stop Scripts**
  - Implemented `scripts/dev-start.ps1` for reproducible dependency bring-up and build validation.
  - Implemented `scripts/dev-stop.ps1` to safely terminate orphaned dev processes.

- [ ] **1.4 End-to-End Validation of `docker compose up`**
  - Verify full stack bring-up (`docker compose up -d`):
    - PostgreSQL 16+ (migrations auto-applied)
    - Azurite blob emulator (MOD-08 lab upload storage)
    - ASP.NET Core API with Hangfire background jobs
    - Frontend Vite PWA with HMR

---

## Phase 2: Feature Completion & FRD Alignment

Target: Close out remaining Phase 1 & 2 acceptance criteria and finalize workspace UX.

- [x] **2.1 Workspace Hub & Navigation Reconciliation**
  - Implemented URL-derived domain switcher (`DashboardLayout.tsx`) filtering navigation by operational domain.
  - Implemented 4 operational launchpad cards in `DoctorDashboard.tsx` and `AdminDashboard.tsx`.

- [x] **2.2 Connect Role Perspective Switcher to Domain Workspace**
  - Connected `Dashboard.tsx` role perspective switcher to URL search parameters (`previewRole` & `domain`).
  - `DashboardLayout.tsx` seamlessly synchronizes: sidebar items, settings link, header preview badge, and mobile bottom navigation dynamically adapt to the simulated perspective while preserving real permissions.

- [ ] **2.3 Comprehensive FRD Acceptance Criteria Walkthrough**
  - Audit all 22 Phase 1 functional requirements (`docs/product/FRD_FINAL.md`) and 9 Phase 2 modules (`FRD-Phase-2-FINAL.md`).
  - Verify every edge case and statutory requirement (Schedule H1 compliance, FEFO batch allocation, DPDP consent tracking).

- [x] **2.4 Synchronize Architecture & Workflow Documentation**
  - Updated `docs/product/WORKFLOW.md` with *Frontend Navigation & Role Workspaces* specification.

---

## Phase 3: Production Readiness & Release Gating

Target: Operational hardening, monitoring, third-party audits, and CI/CD automation.

- [ ] **3.1 Automated CI Pipeline Integration**
  - Configure GitHub Actions pipeline:
    - Code formatting & linting check (`dotnet format`, `npm run lint`)
    - Build validation (`dotnet build`, `npm run build`)
    - Automated unit & integration tests (`dotnet test`)
    - Playwright headless E2E verification
    - Secret scanning gate (TruffleHog / GitGuardian)
    - Vulnerability check (`dotnet list package --vulnerable`)

- [ ] **3.2 Observability & Reliability Infrastructure**
  - Structured application logging with correlation IDs (Serilog).
  - Health check endpoints (`/health/live`, `/health/ready`) with database and storage probes.
  - Automated database backup scripts and disaster recovery / restore drill.

- [ ] **3.3 Third-Party Penetration Testing**
  - Conduct offensive security audit and pen testing focused on:
    - Authentication and session handling (JWT validation, token revocation).
    - Payment integrity (Razorpay webhook forgery, invoice tampering).
    - Pharmacy compliance (Schedule H1 prescription bypass, batch quantity manipulation).

- [ ] **3.4 Explicit Out-of-Scope Boundary Affirmation**
  - Strict scope boundaries preserved per FRD §5.2:
    - Voice Agent (MOD-27) &rarr; Phase 3.
    - IPD & Inpatient Care &rarr; Track 4.
    - UAE & international billing adapters &rarr; Out of scope.
    - Dedicated single-tenant database instances &rarr; Out of scope.
