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

- **Current Milestone**: Phase 2 Track 1 Fast-Follow — **100% shipped (9 of 9 modules)**.
- **Active Focus**: All 9 Phase 2 modules complete. Voice Agent (MOD-27) formally Phase 3 per FRD-Phase2 §9. Pilot launch prep (real WhatsApp/Razorpay/Entra configuration) is the next team-level work.
- **Module Status**:
  - ✅ MOD-23 Pre-Check Form (FR-23-01/02/03)
  - ✅ MOD-24 Emergency Queue (FR-24-01/02)
  - ✅ MOD-25 Live Ticket Tracking (FR-25-01)
  - ✅ MOD-12 Speciality EMR Templates (FR-12-01/02)
  - ✅ MOD-13 Notification Rules Engine (FR-13-01/02/03)
  - ✅ MOD-09 Inventory (FR-09-01/02/03)
  - ✅ MOD-10 Wishlist (FR-10-01)
  - ✅ MOD-08 Lab Records (FR-08-01/02/03)
  - ✅ MOD-11 Finance Ledger (FR-11-01/02/03)
  - ✅ MOD-14 Platform Admin Portal (FR-14-01/02/03/04)
- **Phase 1 Compatibility**: FR-20/21 now MOD-13 defaults (seeded rules, no flow loss).
- **Outstanding pilot-prep work** (not module backlog, just real-integration config):
  - WhatsApp Meta/BSP account + template submission for approval
  - Razorpay merchant account + webhook secret
  - Azure Entra External ID tenant config + role claim mapping
  - S3-compatible blob storage for MOD-08 (currently local disk `lab-uploads/`)
  - S3/storage for `PrecheckSubmission` file attachments if MOD-23 scope expands

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
