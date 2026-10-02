# Progress Log — Hospital_CRM (`issues-fixing` branch)

Session log for the issues-fixing sweep. Each tier is one commit, verified before the next.

---

## Tier status

| Tier | Scope | Commit | Verified |
|---|---|---|---|
| UI polish | Loading/empty states, micro-interactions, page polish across CRM screens | `cdcb764` | build + lint |
| **P0** | Reports: frontend/backend contract alignment, `payment-distribution` + `platform-health` endpoints, real file export | `20e86b7` | build + lint + smoke |
| **P1** | Inventory / Messages / Queue wired to real APIs; fake seed data removed from Appointments + Staff | `1a12cc5` | backend build, 31/31 tests, frontend build+lint, smoke |
| **P2** | 8 missing pages + routes: Lab Orders, Wishlist, Platform Admin, public `/intake/{token}`, `/queue-status/{token}`, forgot/reset password, `/accept-invite` | `b3e45f9` | backend build, 31/31 tests, frontend build+lint, API contract smoke |
| **P4** | `test:e2e` script + `@playwright/test` dep; `ReportsControllerTests` (7 tests) | `ba973be` | 38/38 tests, `--list` discovers 8 e2e tests |
| **P5** | `progress.md`, `Pending Works.md`, `Project Report.md`; state-file link fixes | this commit | all `agents/state/*.md` links resolve |

---

## What each tier changed

### P0 — Reports (`20e86b7`)
- `ReportsController.cs`: added `payment-distribution`, `platform-health`, `POST export` (ITR-4 CSV, GSTR-1 JSON); financial endpoint rebuilt to per-month scoping.
- `Reports.tsx`: removed phantom "FY 2026-27" month option, added tax/ITR-4 link, real blob download instead of fake export.

### P1 — Real API wiring (`1a12cc5`)
- `InventoryController.ListItems` returns live `balance` (SQL group-by; removed a `Contains()` on Guid list that crashed Npgsql's `SqlNullabilityProcessor`).
- `Inventory.tsx`, `Messages.tsx`, `Queue.tsx` rewritten against real endpoints (403 handling, optimistic toggles, 30s polling, session-local triage trail).
- `Appointments.tsx`, `Staff.tsx`: fake seed rows → empty state; fetch now always overwrites (no `length > 0` guard).

### P2 — Missing pages (`b3e45f9`)
- New pages: `LabOrders`, `Wishlist`, `PlatformAdmin`, `Intake`, `QueueStatus`, `ForgotPassword`, `ResetPassword`, `AcceptInvite`.
- Routes in `App.tsx` (public + protected), nav entries + icons in `DashboardLayout.tsx`, role-aware login redirect in `AuthContext.tsx`, forgot-password link on `Login.tsx`.
- **DB fixes** (2 migrations):
  - `20261002071839_CheckPendingDrift` — creates missing `WishlistItems` table (it was in `__EFMigrationsHistory` but absent from the DB).
  - `20261002072629_FixWishlistCreatorFk` — wires `Creator` nav to the `CreatedBy` FK instead of the convention-created shadow `CreatorId` that broke every wishlist insert with an FK violation.

### P4 — Tests (`ba973be`)
- `frontend/package.json`: `"test:e2e": "playwright test"` + explicit `@playwright/test` devDependency (lock synced).
- `ReportsControllerTests.cs`: 7 tests — financial month scoping + clinic filter, payment-distribution splits, platform health counts, GSTR-1 B2B/B2C + cancelled exclusion, ITR-4 CSV export, unsupported format 400, missing identity 401.
- **Bug found & fixed by the tests**: `FinancialSummary` summed `Invoice.GstAmount` per payment, double-counting GST on partially-paid invoices → now grouped by invoice.

### P5 — Documentation (this commit)
- Created `progress.md`, `Pending Works.md`, `Project Report.md`.
- Fixed every markdown link in `agents/state/*.md` (relative paths, `file://` prefixes, moved-file targets; `samstack-implementation-reference.md` unwrapped to plain text since the file doesn't exist). Verification: 0 broken links.
- Refreshed `agents/state/current.md` Pending Works Catalog (6 of 7 items now shipped).

---

## Quality gates (last run)

- `dotnet build` — 0 errors
- `dotnet test tests/Hospital_CRM.Tests` — **38/38 passed**
- `npm run build` (`tsc -b && vite build`) — pass
- `npm run lint` (oxlint) — pass (pre-existing warnings only)
- `npm run test:e2e -- --list` — 8 tests discovered
- API smoke: `/health`, auth, reports, inventory, messages, wishlist (POST/PATCH), precheck (400 invalid token), queue-status (404), platform-admin tenants (403/200)

---

## Not done here
See [`Pending Works.md`](Pending%20Works.md). AGENTS.md has stale paths — listed there for review, not edited.
