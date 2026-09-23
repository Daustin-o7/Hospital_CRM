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

- **Current Milestone**: Core Platform Hardening, Azure Entra ID OIDC Auth, and Design System Consolidation — **Shipped**.
- **Active Focus**:
  - ✅ **Phase 0: Backend Correctness**: Fixed Typesense dual collection provisioning (`EnsureCollectionsAsync`), corrected `MedicinesSearchAsync` search fields, implemented typed `TypesenseMedicineDocument` and Hangfire reindexing job (`ITypesenseHangfireJobs`), aligned `SyncController` with offline sync contract (patient/walk-in invoice validation + bounds), created dedicated `GET /api/v1/medicines/search` endpoint.
  - ✅ **Phase 1: Auth Hardening**: Implemented Azure Entra External ID (CIAM) OIDC via PKCE (`oidc.ts`, `AuthCallback.tsx`, `AuthContext.tsx`, `Login.tsx`), removed dev backdoor bypass credentials from auth flow.
  - ✅ **Phase 2: CSS Design System Consolidation**: Aligned outlier views to standard design tokens (`.card`, `.btn`, `.form-*`, `.data-table`, `.stat-card`, `.badge`), fixed Settings typo (`/cllinic/` -> `/clinic/`), hooked up global `Ctrl+K` patient search & notification bell in topbar, updated `.gitignore` with secrets exclusions, and sanitized unsupported compliance claims.
  - ✅ **Phase 3: Core Workflow Wiring**: Fully wired `Billing.tsx` (invoices, payments, expense ledger) and `Consultations.tsx` (clinical queues, v1 notes, immutable amendments, live drug search & e-prescriptions).
- **Pending Works Catalog** (Deferred for explicit separate phases):
  - ⏳ Mobile App: React Native Android project scaffolding & Maestro testing (Dual-path preserved with PWA; held).
  - ⏳ Full backend wiring for Messages / Notification Rules UI.
  - ⏳ Full backend wiring for Inventory inwarding / stock batch sync.
  - ⏳ Backend endpoint for Reports / Tax analytics (`ReportsController`).
  - ⏳ Dedicated Lab Orders UI & Wishlist UI pages.
  - ⏳ Dedicated Platform Admin Multi-Tenant Portal UI.
  - ⏳ End-to-End Playwright test suite for PWA & Doctor workflows.

---

## Implementation Details

```
[ Active Workstream — Post-Phase-2 ]
  ├── Pilot launch prep: real WhatsApp / Razorpay / Entra External ID config
  ├── Voice Agent (Phase 3) — sequencing per FRD-Phase2 §9
  └── (no remaining Phase 2 modules — all 9 shipped)
```

---

## Important Files

- [`docs/product/WORKFLOW.md`](file://docs/product/WORKFLOW.md) — **Complete Phase 1 + Phase 2 workflow** (every FR, ASCII diagrams, patient journey, endpoint map)
- [`FRD-Phase-2-FINAL.md`](file://FRD-Phase-2-FINAL.md) — Phase 2 FRD (all 9 modules)
- [`TRD-Phase2-V1.md`](file://TRD-Phase2-V1.md) — Phase 2 TRD (Hangfire, blob storage)
- [`PRD-Phase2-V1.md`](file://PRD-Phase2-V1.md) — Phase 2 PRD with journey stories
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

- [`FRD-Phase-2-FINAL.md`](file://FRD-Phase-2-FINAL.md)
- [`TRD-Phase2-V1.md`](file://TRD-Phase2-V1.md)
- Server log verification of all 6 shipped modules
