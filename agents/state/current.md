# System State: Current Sprint & Implementation Focus (`state/current.md`)

This document defines the current active implementation milestone, sprint focus, and immediate tasks for SAMSTACK AI.

---

## Purpose

To track the exact current work focus, active requirements under development, and immediate action items.

---

## Scope

Covers Phase 1 (FR-01–22, complete) and Phase 2 Track 1 Fast-Follow modules in progress.

---

## Verified Information

- **Current Milestone**: Security Hardening & OWASP Top 10 Audit Remediation (`feat/security-hardening`).
- **Active Focus**:
  - ✅ **Rate Limiting Loopback Throttling**: Restored loopback throttling, strictly gating no-limiter on `IsDevelopment()`.
  - ✅ **Brute-Force Lockout Defense**: Implemented 5-attempt/15-minute account lockout in `AuthController.Login` checked before password verification.
  - ✅ **Account Enumeration Fixed**: Standardized locked account response to generic 401 `invalid_credentials`.
  - ✅ **Vulnerability Remediated**: Upgraded `System.Security.Cryptography.Pkcs` and `Xml` to `10.0.13` (GHSA-2fmv-rv2c-59x7 resolved).
  - ✅ **JWT Pinning & Cookie Security**: Pinned `ValidAlgorithms = ["RS256"]`, configured `UseForwardedHeaders`, enforced `Secure` cookies.
  - ✅ **Least-Privilege Database User**: Created `scripts/setup-least-privilege-db.sql` for `app_user` with append-only audit enforcement.
  - ✅ **Configuration Hygiene**: Cleaned obsolete HMAC key from `appsettings.Development.json`; completed `.env.example`.
  - ✅ **Dev & CI Tooling**: Added `scripts/dev-start.ps1`, `scripts/dev-stop.ps1`, and `scripts/check-process-leaks.ps1`.
  - ✅ **Role Perspective Switcher Synchronized**: Connected `Dashboard.tsx` perspective switcher to URL query params, synchronizing `DashboardLayout.tsx` sidebar, settings, header, and mobile nav.
  - ✅ **Git History Purged**: Purged `jwt-private.pem` from all Git commits via `git-filter-repo`; restored `origin` remote.
- **Master Action Plan**: Tracked comprehensively in [`TODO.md`](../../TODO.md) and [`Pending Works.md`](../../Pending%20Works.md).

---

## Implementation Details

```
[ Active Workstream — Security Hardening ]
  ├── Branch: feat/security-hardening (checked out from main at ce53300)
  ├── Phase 0: Security & OWASP Top 10 Remediations (Blocking)
  ├── Phase 1: End-to-End Test & Dev Process Verification
  ├── Phase 2: Feature Completion against FRD
  └── Phase 3: CI/CD & Production Release Readiness
```

---

## Important Files

- [`docs/product/WORKFLOW.md`](../../docs/product/WORKFLOW.md) — **Complete Phase 1 + Phase 2 workflow** (every FR, ASCII diagrams, patient journey, endpoint map)
- [`FRD-Phase-2-FINAL.md`](../../FRD-Phase-2-FINAL.md) — Phase 2 FRD (all 9 modules)
- [`TRD-Phase2-V1.md`](../../docs/technical/TRD-Phase2-V1.md) — Phase 2 TRD (Hangfire, blob storage)
- [`PRD-Phase2-V1.md`](../../docs/product/PRD-Phase2-V1.md) — Phase 2 PRD with journey stories
- `memory.md` — Session working memory
- `backend/Hospital_CRM.Api/Controllers/ConsultTemplatesController.cs` — MOD-12
- `backend/Hospital_CRM.Api/Controllers/MessageTemplatesController.cs` — MOD-13
- `backend/Hospital_CRM.Api/Controllers/NotificationRulesController.cs` — MOD-13
- `backend/Hospital_CRM.Api/Controllers/QueueStatusController.cs` — MOD-25
- `backend/Hospital_CRM.Api/Services/NotificationRulesWorker.cs` — MOD-13 worker
- `backend/Hospital_CRM.Api/Services/PrecheckService.cs` — MOD-23
- `backend/Hospital_CRM.Api/Controllers/PrecheckController.cs` — MOD-23
- `backend/Hospital_CRM.Api/Controllers/PrecheckReviewController.cs` — MOD-23
- `backend/Hospital_CRM.Domain/Entities/PrecheckSubmission.cs` — MOD-23
- `backend/Hospital_CRM.Domain/Entities/PriorityLog.cs` — MOD-24
- `backend/Hospital_CRM.Domain/Entities/ConsultTemplate.cs` — MOD-12
- `backend/Hospital_CRM.Domain/Entities/NotificationRule.cs` — MOD-13
- `backend/Hospital_CRM.Domain/Entities/MessageTemplate.cs` — MOD-13
- `backend/Hospital_CRM.Domain/Enums/AppointmentPriority.cs` — MOD-24
- `backend/Hospital_CRM.Domain/Enums/NotificationEnums.cs` — MOD-13

---

## Dependencies

- .NET 10 SDK & Node.js environment ✅
- PostgreSQL 16+ database host ✅
- Azure Entra External ID OIDC (not yet configured — stub auth via local JWT)
- Razorpay Merchant Account (not yet — stub)
- Meta / BSP WhatsApp Business API Account (not yet — stub)

---

## Risks

- **Module Scope Drift**: Adding features not in MOD-09/08/10/11/14 FRD sections.
- **Phase 1 Regression**: MOD-13 migration of FR-20/21 to rules-based must not break the existing booking/reminder flow.

---

## Future Improvements

- Hangfire migration for NotificationRulesWorker (currently BackgroundService, fine for one job).
- Blob storage for MOD-08 lab result file uploads (TRD-Phase2 §3).

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Should MOD-11 Finance Ledger be deferred past pilot launch?

---

## Last Verified Date

2026-08-30

---

## Verification Source

- [`FRD-Phase-2-FINAL.md`](../../FRD-Phase-2-FINAL.md)
- [`TRD-Phase2-V1.md`](../../docs/technical/TRD-Phase2-V1.md)
- Server log verification of all 6 shipped modules
