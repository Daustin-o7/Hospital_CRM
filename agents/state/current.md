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

- **Current Milestone**: Platform Admin console + commercialisation (branch `feat/platform-admin-console`, cut from `main` at `ce53300`).
- **Previous Milestone (complete)**: Security Hardening & OWASP Top 10 Audit Remediation (`feat/security-hardening`).
  - ✅ Rate limiting loopback throttling gated on `IsDevelopment()`; 5-attempt/15-minute lockout in `AuthController.Login`; account enumeration fixed to a generic 401; `System.Security.Cryptography.Pkcs`/`Xml` upgraded to `10.0.13`; JWT pinned to `RS256` with `UseForwardedHeaders` and `Secure` cookies; `scripts/setup-least-privilege-db.sql` created; obsolete HMAC key removed from `appsettings.Development.json`; `scripts/dev-start.ps1`, `dev-stop.ps1`, `check-process-leaks.ps1` added; perspective switcher synchronized with URL query params.
  - ✅ **Git history purged** of `jwt-private.pem` via `git-filter-repo` — independently re-verified 2026-10-19: no `jwt-private` blob is reachable from any branch.
- **Active Focus — decisions confirmed 2026-10-19.** Full text in `Platform-Admin-Master-TODO.md` §0 "Decisions as confirmed":
  - ✅ **D1 (amended)**: `TenantId` is the key everywhere, never `Clinic.Id`; one clinic : one tenant; **a real `tenants` table is built now**, not deferred.
  - ⚠️ **D2 (overridden)**: **shared database from the first client.** This makes tenant isolation (**B1**) a *pre-pilot* blocker, not a post-pilot one. Biggest scope change of the set.
  - ✅ **D3**: suspension = **3 days** read-only, then blocked.
  - ✅ **D4**: impersonation read-only, ≤30 min, written reason (legal review still open).
  - ✅ **D5**: 5 tiers (Starter / Professional / Enterprise / EnterprisePlus / Private) × 5 statuses (Trial / Active / PastDue / Suspended / Cancelled).
  - ✅ **D6**: `ActivatedModules` is entitlement, flags are overrides, one gate evaluates both.
  - ⚠️ **D7 (overridden)**: hybrid direct-to-clinic payments — SAMSTACK never holds patient funds; PSP business webhooks primary, Android notification bridge fallback, manual "Mark as Paid" + UTR; Razorpay optional for remote SMS links.
  - ✅ **D8**: manual provisioning for the first ~5 clients; self-serve deferred.
  - ✅ **Closed this session**: P0-3 (startup config guard), P0-4 (verified: Production seeds zero users), A2 (`ModuleRegistry`), A6 (authorization-enumeration test + IP allowlist + lazy route), A8 (documentation). P0-1 rotation done and history purge verified; the CI secret-scanner is still open (no CI exists).
  - ✅ **Delivery-path defects fixed**: migrations no longer require a superuser; the runtime role is now `app_user`, and `UPDATE`/`DELETE` on the audit tables are denied to it at the database level (verified).
  - ⬜ **Next**: **A3** — the `tenants` table plus the single `IsModuleEnabledAsync(tenantId, code)` gate, which is the actual cause of the broken pharmacy toggle.
- **Master Action Plan**: [`Platform-Admin-Master-TODO.md`](../../Platform-Admin-Master-TODO.md) is authoritative. Repo-wide context: [`TODO.md`](../../TODO.md), [`Pending Works.md`](../../Pending%20Works.md).

---

## Implementation Details

```
[ Active Workstream — Platform Admin & Commercialisation ]
  ├── Branch: feat/platform-admin-console (from main at ce53300)
  ├── Phase 0: Delivery blockers (P0-1..P0-5) — P0-3/P0-4 done, P0-1 partial
  ├── Phase A: Make the shipped MOD-14 correct (A1..A8) — A2/A6/A8 done
  ├── Phase B: Make it sellable — B1 tenant isolation is the CRITICAL PATH (D2)
  └── Phase C: Only against a signed deal (not active work)
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
- **Tenant isolation is now on the critical path**: decision **D2** (shared database from the first client) means **B1** must be proven before the first real clinic, not the second. Every query, background job, cache key and blob path has to carry a tenant. Do not onboard a clinic on a shared database before B1 passes.

---

## Future Improvements

- Hangfire migration for NotificationRulesWorker (currently BackgroundService, fine for one job).
- Blob storage for MOD-08 lab result file uploads (TRD-Phase2 §3).

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Should MOD-11 Finance Ledger be deferred past pilot launch?

---

## Last Verified Date

2026-10-19

---

## Verification Source

- [`FRD-Phase-2-FINAL.md`](../../FRD-Phase-2-FINAL.md)
- [`TRD-Phase2-V1.md`](../../docs/technical/TRD-Phase2-V1.md)
- Server log verification of all 6 shipped modules
