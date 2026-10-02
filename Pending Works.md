# Pending Works — Hospital_CRM

Single consolidated backlog. Anything not listed here is either shipped or explicitly out of scope (FRD §5.2).

---

## 1. Pilot launch configuration (not code — vendor/portal setup)

- [ ] **Azure Entra External ID**: tenant, redirect URIs, role-claim mapping. Blocker for production auth; local dev uses JWT RS256 with persistent key.
- [ ] **Razorpay**: merchant account, `Razorpay:KeySecret`, webhook URL in Razorpay dashboard. Worker runs but keys are empty.
- [ ] **WhatsApp Business API**: Meta/BSP account + template approval. Notifications currently go through `StubNotificationService` (console log).
- [ ] **S3-compatible blob storage** for MOD-08 lab uploads (currently local disk `lab-uploads/`) — swap via `AzureStorage__ConnectionString`, per TRD-Phase2 §3.

## 2. Known debt (accepted, with ceiling)

- [ ] **Expense clinic-filter** (`ReportsController.FinancialSummary`): `LedgerExpense` has no `ClinicId`, so expenses are reported per-tenant only — single-tenant debt, invisible until Tier-2 tenancy. Upgrade path: add `ClinicId` column.
- [ ] **Queue priority audit is session-local**: the Queue page trail resets on refresh; DB `PriorityLog` already exists (`PATCH /appointments/{id}/priority`). Upgrade path: read `PriorityLog` into the page.
- [ ] **Inventory restock is fixed 50 units** (`RESTOCK_QTY`, `ponytail:` comment in `Inventory.tsx`) — add a quantity prompt when a clinic asks.
- [ ] **Messages "Send Test" is disabled** until a real notification channel exists (honest UI; enabling it with the stub just lies).
- [ ] **Partial e2e verification**: `test:e2e` script added and discovers 8 Playwright tests; the suite has **not** been executed end-to-end against running dev servers in this session (`npx playwright install` may also be needed on fresh machines).
- [ ] **HTTP polling** (30s) for schedule/queue instead of SignalR — accepted at OPD scale (state/technical-debt.md #4).
- [ ] **Static in-code role permission map** instead of DB-driven permissions (FR-02) — refactor when Track 2/4 roles land (state/technical-debt.md #3).
- [ ] **`NotificationRulesWorker` on `BackgroundService`** instead of Hangfire (ADR-09) — migrate when job count > 3.

## 3. Deferred features (explicit phases)

- [ ] **Mobile app**: React Native tree is currently broken — held for explicit go-ahead.
- [ ] **FR-22 offline sync**: client-side idempotency keys for registration/billing exist; full IndexedDB queue not built.
- [ ] **Platform Admin Tier-2 features**: tenant impersonation/flags — endpoints deliberately not built (FR-14-01 list only; tier-gated).
- [ ] **Razorpay refund API** — Track 2b TODO at `PharmacyController.cs:1182`.
- [ ] **Voice Agent (MOD-27)** — Phase 3 per FRD-Phase2 §9.
- [ ] **UAE/international payment adapter** — India-only adapters per scope.
- [ ] **Dedicated DB/instance tenancy** — Tier-2+.

## 4. Documentation follow-ups

- [ ] **`AGENTS.md` stale paths flagged, not edited** (needs owner review):
  - `samstack-ai-frd-phase1-FINAL.md` → file does not exist; Phase 1 FRD lives at `docs/product/FRD_FINAL.md`.
  - `TOOLING-SETUP.md` (root) → actual: `docs/technical/TOOLING-SETUP.md`.
  - `samstack-implementation-reference.md` → never created (AGENTS.md itself notes this).
  - `docs/product/FRD_FINAL.md` reference is correct; `docs/product/WORKFLOW.md` correct.
- [ ] `agents/state/known-limitations.md` #3 says "No Pharmacy Dispensing & Inventory" — pharmacy (POS/FEFO/batches/compliance) shipped in commits `9277db2`/`9161326`/`bc09287`. Statement is stale; needs a status edit when that file is next touched.
- [ ] `agents/state/context.md` header still says "6 of 11 modules shipped / 5 remaining" — stale (9 of 9 shipped); links already fixed.

## 5. Out of scope (do not build without FRD change)

Pharmacy Track 2 remainder, AI features (Track 3), IPD (Track 4), regulated AI/CDSS — per FRD §5.2.
