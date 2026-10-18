# MEMORY.md — Samstack Hospital CRM

**Last updated:** 2026-09-04 (end of session)
**Session mode:** Build
**Project root:** `E:\Company\Hospital Management\Hospital_CRM`

---

## 📊 Current State at a Glance

| Track | Status |
|---|---|
| Phase 1 (FR-01 to FR-22) | ✅ SHIPPED & VERIFIED — 22/22 FRs, 57/57 bugs fixed |
| Phase 2 (10 modules) | ✅ SHIPPED & STABILIZED |
| Hardening & Security | ✅ DONE (in-memory access tokens, DOB binding, file upload validation, append-only logs) |
| Frontend UI/UX | ✅ REDESIGNED (dark navy shell, KPI dashboard, all 10 modules screens) |
| Track 2 Pharmacy 2a (MOD-15/16/17 core) | ✅ **SHIPPED** — Drug catalog, FEFO batches, POS checkout, Schedule H/H1 compliance register, generic substitutes, supplier/GRN scaffold |
| Track 2 Pharmacy 2b (stabilize) | ⏳ ACTIVE — Returns, GRN receive, Rx-dispense, tenant feature flag |
| Pilot Prep (real integrations) | ⏳ NEXT |
| Phase 3 Voice Agent (MOD-27) | 📋 Deferred per FRD-Phase2 §9 |
| Tracks 3/4 (AI/IPD) | 📋 Deferred |

**Implementation size:** 19 Controllers, 38 Domain Entities, 30 Migrations, 27 .tsx pages

---

## 🏗 Pharmacy Track 2 Status

**Track 2a (CORE) — SHIPPED on `feature/pharmacy-pos-dispensary` branch:**
- Drug catalog (`Drug`, `DrugBatch`, `Supplier`, `PurchaseOrder`, `DispenseRecord`, `DispenseItem`, `ControlledSubstanceRegister`)
- Enums: `ScheduleClass` (General/H/H1/NDPS/X), `InvoiceType` (Consultation/Pharmacy), `PurchaseOrderStatus`
- Migration `20260904201324_AddPharmacyTrack2`: creates 7 tables, makes `Invoice.AppointmentId` nullable, adds walk-in fields, adds `InvoiceLineItem` pharmacy columns (Quantity, UnitPrice, GstRate, HsnCode, DrugBatchId)
- `PharmacyController` at `/api/v1/pharmacy`: drugs CRUD, FEFO batch endpoint, stock inwarding, POS checkout (idempotent, Schedule H/H1 gate, controlled substance register write, Razorpay payment → MOD-11 ledger auto-reconciles), generic substitutes (by generic name), pharmacy stats, supplier CRUD
- Frontend: `/dashboard/pharmacy/pos` (PharmacyPOS.tsx), `/dashboard/pharmacy/batches` (PharmacyBatches.tsx), `/dashboard/pharmacy/compliance` (PharmacyCompliance.tsx)
- Nav + RBAC in DashboardLayout; Pharmacist/Nurse/PlatformAdmin dev presets in Login
- Seed: `Indian_Essential_Medicine_Master.csv` → 90 drugs with 2 batches each + supplier

**Track 2b (STABILIZE) — QUEUED on `feature/track2-stabilize` (next branch):**
- Returns/Refund endpoint (reverse POS sale, restore batch stock, Razorpay refund)
- PO receive/GRN flow (`POST /purchase-orders/{id}/receive` → auto-create DrugBatch rows)
- Rx-to-Dispense endpoint (`POST /pharmacy/dispense` from PrescriptionId, same Schedule H/H1 gate)
- MOD-14 tenant feature flag `pharmacy` (per-tenant toggle)
- Wire or remove orphan `DispenseRecord` entity

**Key Architectural Facts (verified by code):**
- `Invoice` entity has nullable `AppointmentId` + `WalkInCustomerName/Phone` — walk-in billing works via `InvoiceType.Pharmacy`
- `InvoiceLineItem` has `Quantity`, `UnitPrice`, `GstRate`, `HsnCode`, `DrugBatchId` — pharmacy lines fully modeled
- `UserRole` enum has `Pharmacist`, `Nurse`, `PlatformAdmin`
- `PrescriptionItem.MedicineText` remains free-text (no drug master link; substitute finder uses generic name fuzzy match)
- MOD-11 income query reads `payments` table — pharmacy sales auto-reconcile via `Payment` entity
- All entities have dormant `tenant_id` = `Guid.Empty`

---

## 📁 Key Files & Their State

### Documentation (updated this session)
- `docs/product/WORKFLOW.md` — Complete Phase 1+2+Pharmacy2a workflow with ASCII diagrams, patient journey, full endpoint map
- `docs/PLAN_FINAL.md` — Final plan with executive summary, ADRs 07-12, approval checklist
- `docs/CHECKLIST.md` — Remaining work checklist (Track 2b stabilize, pilot prep, deferred tracks, tech debt)
- `AGENTS.md` — Updated to reflect Phase 1+2+Pharmacy2a shipped; Track 2b active
- `agents/state/current.md` — Track 2a shipped, Track 2b active, pilot prep next
- `agents/state/completed.md` — All modules + Track 2a documented with dates
- `agents/state/pending.md` — Track 2b items + pilot prep tracked
- `agents/state/context.md` — Macro context refreshed
- `agents/state/decisions.md` — ADRs 01-12 (ADR-12: Pharmacy Track 2 as single-app, separate Drug entity)
- `agents/state/technical-debt.md` — 10 items (TD-9: orphan DispenseRecord; TD-10: missing tenant flag for pharmacy)
- `agents/state/known-limitations.md` — Pharmacy 2a shipped, returns/GRN/Rx-dispense/tenant flag pending
- `agents/state/changelog.md` — 2026-09-04 entry for Track 2a
- `agents/state/bugs.md` — 57/57 fixed

### ADRs (6 new this session)
- **ADR-07:** Persistent RS256 key storage (hybrid PemFileKeyService + AzureKeyVaultKeyService)
- **ADR-08:** `IPostConfigureOptions<JwtBearerOptions>` over `BuildServiceProvider` anti-pattern
- **ADR-09:** `BackgroundService` over Hangfire for MOD-13 worker
- **ADR-10:** MOD-23 pre-check token in same transaction as appointment booking
- **ADR-11:** `PrecheckReviewController` extracted to own file with direct lowercase route
- **ADR-12:** Pharmacy Track 2 as single-app, separate Drug entity (NOT extended InventoryItem) + Reuse Invoice for walk-in pharmacy billing via InvoiceType.Pharmacy + nullable AppointmentId on Invoice

---

## 🏃 Pilot Prep Checklist (next priority)

1. WhatsApp Meta/BSP account + template approval
2. Razorpay merchant account + webhook URL config
3. Azure Entra External ID tenant + role claim mapping + OIDC
4. S3-compatible blob storage for MOD-08 file uploads
5. Observability: structured logging, metrics, health endpoints
6. Docker (3-day effort)

---

## ⚙️ Working Conventions (from AGENTS.md + memory)

- **Stack:** .NET 10 (Minimal APIs, EF Core 10), React 19 PWA, PostgreSQL 16+
- **Auth:** Azure Entra External ID (managed OIDC, not Duende)
- **Payments:** Razorpay
- **Messaging:** WhatsApp Business API
- **tenant_id** dormant in Phase 1, use `Guid.Empty`
- **Audit logs:** DB role `app_user` has `REVOKE UPDATE, DELETE` on audit tables
- **Amendments, never overwrites** on clinical data (FR-14/15/08)
- **Route style:** direct lowercase (`api/v1/resource-name`), NOT `[Route("api/v1/[controller]")]`
- **JSONB columns:** `.HasColumnType("jsonb")` for string properties holding JSON
- **BackgroundService:** use `IServiceScopeFactory` for scoped services, NOT direct DbContext injection
- **Git:** NEVER push/auto-commit without explicit approval. Always create feature branch first.
- **Ponytail discipline:** "don't build infrastructure the product doesn't need yet" (TRD_Phase1 §10)

---

## 🔁 Resume Instructions for Next Session

**If continuing Track 2b (stabilize):**
1. Create branch `feature/track2-stabilize` from `feature/pharmacy-pos-dispensary`
2. Implement Returns/Refund endpoint
3. Implement PO receive/GRN flow
4. Implement Rx-to-Dispense endpoint
5. Add MOD-14 tenant feature flag `pharmacy`

**If pilot prep:**
1. WhatsApp Meta/BSP account + template approval submission
2. Razorpay merchant account + webhook
3. Azure Entra External ID tenant + role claims
4. S3-compatible blob storage for MOD-08

**If starting Phase 3 (Voice Agent):**
1. Read `samstack-ai-phase2-voice-agent-analysis.md` fully
2. Skip §17 (priority order — superseded)
3. Start with compliance review

**Server state:** Currently `http://localhost:5000` (may or may not be running, check on resume)
**Database:** PostgreSQL with 29 migrations applied (30th pending: AddPharmacyTrack2), `app_user` role with REVOKE on audit tables
**Branch:** `feature/pharmacy-pos-dispensary` (3 commits: schema, backend, frontend)