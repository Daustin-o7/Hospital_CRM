# Project Report — Hospital_CRM (SAMSTACK AI)

**Date:** 2 October 2026 · **Branch:** `issues-fixing` · **Repo:** `E:\Company\Hospital Management\Hospital_CRM`

---

## 1. Executive summary

Hospital_CRM is a doctor/clinic CRM for Indian OPD clinics. **Phase 1 (FR-01–22) and Phase 2 (all 9 modules) are shipped and verified.** This report covers the state of the codebase after the issues-fixing sweep (commits `cdcb764` → `P5`), which closed the remaining frontend/backend contract gaps, removed fake seed data, built the last missing pages, fixed two database bugs, and added the missing test scaffolding and documentation.

Current quality gates: **backend build 0 errors, 38/38 xUnit tests, frontend build + lint pass, 8-test Playwright suite discoverable via `npm run test:e2e`.**

---

## 2. Product scope

| Track | Status |
|---|---|
| Phase 1 — CRM + Billing, India adapter, shared SaaS tier (FR-01–22) | ✅ Shipped |
| Phase 2 — 9 modules: MOD-08 Lab, 09 Inventory, 10 Wishlist, 11 Finance Ledger, 12 Templates, 13 Notifications, 14 Platform Admin, 23 Pre-Check, 24 Emergency Queue, 25 Live Ticket | ✅ Shipped |
| Pharmacy (Track 2 partial: POS, FEFO batches, inward, compliance, substitutes) | ✅ Shipped in earlier commits (`9277db2`, `9161326`, `bc09287`) |
| Voice Agent (MOD-27) | Phase 3 — not started |
| AI features (Track 3), IPD (Track 4), UAE adapter, dedicated-DB tenancy | Out of scope per FRD §5.2 |
| Mobile app (React Native) | Held — tree currently broken |

Roles: ClinicAdmin, Doctor, Reception, Nurse, Pharmacist, PlatformAdmin — server-side RBAC via `AuthorizeRoles`.

---

## 3. Technology & architecture

- **Backend**: .NET 10 (ASP.NET Core minimal APIs, C# 14), EF Core 10, PostgreSQL 16. `DbContext` in `Hospital_CRM.Infrastructure`, hot paths use compiled queries, cancellation tokens on async I/O, RFC 7807-style typed errors.
- **Frontend**: React 19 + Vite + Tailwind CSS v4 (mobile-first PWA), React Hook Form + Zod, local state by default, OIDC (`oidc-client-ts`) with in-memory tokens; role gating via `useAuth().hasRole()`.
- **Auth**: local dev = JWT RS256 with persistent PEM key + `/.well-known/jwks.json`; production target = Azure Entra External ID (not yet configured).
- **Background work**: Hangfire (Postgres storage, in-process) + `BackgroundService` for notification rules (ADR-09).
- **Messaging/payments**: WhatsApp via `StubNotificationService` (console) behind a channel interface; Razorpay signature verification implemented, keys empty.
- **Conventions**: UUID PKs, dormant `tenant_id` on tenant-scoped tables, append-only audit (DB-role `REVOKE UPDATE, DELETE`), amendments-never-overwrites on clinical data, feature-branch git flow with explicit-approval commits.

---

## 4. What this session fixed (P0 → P5)

### P0 — Reports contract (`20e86b7`)
Frontend asked for months/fields the backend didn't return. Added `GET /reports/payment-distribution` (UPI/Card/Cash split + percentages), `GET /reports/platform-health` (tenants/users/consultations + status), `POST /reports/export` (ITR-4 CSV, GSTR-1 JSON blob download); removed the phantom "FY 2026-27" month from `Reports.tsx`.

### P1 — Real data, no fake rows (`1a12cc5`, 6 files, +706/−545)
- **Inventory**: controller now returns live `balance` per item; removed a `Contains()` over a Guid list that crashed Npgsql's `SqlNullabilityProcessor` (`PgAnyExpression`) — filter replaced with SQL group-by aggregation. Page rewired with role-gated add/restock.
- **Messages**: wired to `/notification-rules` + `/message-templates`; 403 → honest empty state; optimistic rule toggles; Send-Test disabled until a real channel exists.
- **Queue**: wired to today's appointments with 30s polling, priority PATCH, session-local triage trail; fake rows and dead "Call" button removed.
- **Appointments / Staff**: fake seed doctors/patients/staff → real fetches with proper loading and error states.

### P2 — The 8 missing pages (`b3e45f9`)
`LabOrders` (pending-first tabs, patient name resolution, result version badges), `Wishlist` (add/edit/done/cancel, category+status filters), `PlatformAdmin` (debounced tenant search — FR-14-01 list only, impersonation tier-gated), public `Intake` (pre-check form with DOB identity verification), public `QueueStatus` (live token polling), `ForgotPassword`, `ResetPassword`, `AcceptInvite` — all routed, nav-wired, with icons; login now role-redirects PlatformAdmin.

**Two database bugs surfaced and fixed:**
1. `WishlistItems` was recorded in `__EFMigrationsHistory` but missing from the DB (model refit `CreatedBy`→`CreatorId` never migrated) → `CheckPendingDrift` migration creates the table.
2. Even with the table, every insert failed an FK violation: the entity's `Creator` navigation had no configuration, so EF created a **shadow `CreatorId` FK left as `Guid.Empty`**. → `FixWishlistCreatorFk` migration re-wires `HasOne(Creator).WithMany().HasForeignKey(CreatedBy)` (same pattern as `PurchaseOrder`).

### P4 — Test scaffolding (`ba973be`)
- `npm run test:e2e` script + explicit `@playwright/test` devDependency; `playwright.config.ts` + `e2e/full-flow.spec.ts` already existed (8 tests, discovered).
- `ReportsControllerTests.cs` — 7 tests: month scoping + clinic filter, MoM/percentage math, payment-method splits, platform-health counts, GSTR-1 B2B/B2C with cancelled exclusion, ITR-4 CSV file content, unsupported format 400, missing identity 401.
- The tests caught a **real bug**: GST liability summed `Invoice.GstAmount` per payment, double-counting partially-paid invoices → now grouped by invoice.

### P5 — Documentation
`progress.md`, `Pending Works.md`, this report; every markdown link in `agents/state/*.md` fixed and verified (0 broken); `current.md` pending catalog refreshed; AGENTS.md stale paths flagged for review (see Pending Works §4).

---

## 5. Database

- Migrations: `backend/Hospital_CRM.Infrastructure/Migrations/`
- Added this session:
  - `20261002071839_CheckPendingDrift` — creates `WishlistItems` (id, tenant_id, created_by FK→users, text varchar(1000), category, status, created_at, updated_at + indexes).
  - `20261002072629_FixWishlistCreatorFk` — drops shadow `CreatorId`, FK moves to `CreatedBy`, adds `TenantId+Status` index, narrows `Text` to `varchar(1000)`.
- Local dev: `docker compose up -d` runs postgres + azurite + api (migrations + seed on startup) + frontend.

---

## 6. Quality assurance

| Gate | Result |
|---|---|
| `dotnet build` | 0 errors |
| `dotnet test` | **38/38 passed** (31 pre-existing + 7 new Reports tests) |
| `npm run build` | pass (`tsc -b && vite build`) |
| `npm run lint` | pass (oxlint, pre-existing warnings only) |
| `npm run test:e2e -- --list` | 8 Playwright tests discovered |
| API smoke (this session) | auth, reports (all 5), inventory balance after movement, notification-rules, wishlist POST/PATCH, precheck 400 on bogus token, queue-status 404, platform-admin tenants 200/403 |

E2E execution against live servers not yet run — see Pending Works §2.

---

## 7. Security posture

- Server-side RBAC on every mutating endpoint; roles never trusted from the client.
- JWT RS256 with persistent key + JWKS endpoint; Entra External ID ready (config pending).
- Razorpay webhook HMAC verification with constant-time comparison.
- Public token endpoints (`/precheck/{token}`, `/queue-status/{token}`) return no PHI; identity verified by DOB on intake.
- Password reset issues an opaque single-use token; request endpoint always returns 200 (no account enumeration).
- Audit append-only enforced at DB-role level; clinical data amended, never overwritten.

---

## 8. Known limitations

Full list in [`Pending Works.md`](Pending%20Works.md). Headlines: stub WhatsApp/Razorpay/Entra until vendor config; expenses reported per-tenant only (no `ClinicId` on ledger); queue priority trail is session-local; offline sync (FR-22) partial; mobile app held; PlatformAdmin Tier-2 features deliberately unbuilt; 30s polling instead of SignalR.

---

## 9. How to run

```bash
cp .env.example .env && docker compose up -d   # postgres + azurite + api + frontend
# or manually:
dotnet run --project backend/Hospital_CRM.Api  # https://localhost:7001 (dev cert), smoke tests used :5000
cd frontend && npm install && npm run dev      # http://localhost:5173
npm run test:e2e                               # requires frontend+backend running
dotnet test tests/Hospital_CRM.Tests
```

Dev logins: `admin@samstack.ai`, `doctor@samstack.ai`, `reception@samstack.ai`, `pharmacist@samstack.ai`, `platform-admin@samstack.ai` (passwords seeded by `SeedDevelopmentDataAsync`).

---

## 10. Git history (branch `issues-fixing`, 30 commits, 2026-08-26 → 2026-10-02)

```
ba973be test: add Playwright e2e script and Reports endpoint tests
b3e45f9 feat(pages): add Lab Orders, Wishlist, Platform Admin and public token pages
1a12cc5 fix(pages): wire Inventory, Messages, Queue to real APIs and remove fake seed data
20e86b7 fix(reports): align frontend/backend contracts, add payment-distribution and platform-health, real file export
cdcb764 feat(ui): loading/empty states, micro-interactions, and page polish across CRM screens
…       (prior: pharmacy track, phase 2 modules, docker, mobile, security hardening — 25 earlier commits)
```

---

## 11. Reference documents

- [`docs/product/FRD_FINAL.md`](docs/product/FRD_FINAL.md) — Phase 1 FRD (FR-01–22)
- [`FRD-Phase-2-FINAL.md`](FRD-Phase-2-FINAL.md) — Phase 2 FRD (9 modules)
- [`docs/product/WORKFLOW.md`](docs/product/WORKFLOW.md) — complete workflow, ASCII diagrams, endpoint map
- [`docs/technical/TRD-Phase2-V1.md`](docs/technical/TRD-Phase2-V1.md) — Phase 2 TRD
- [`agents/state/`](agents/state/) — context, decisions, bugs (57/57 resolved), technical debt, known limitations
- [`progress.md`](progress.md) — this session's tier-by-tier log
