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
