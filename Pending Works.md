# Pending Works — Hospital_CRM

Single consolidated backlog. Anything not listed here is either shipped or explicitly out of scope (FRD §5.2).

> **Master Roadmap & Detailed Checklist:** See [`TODO.md`](TODO.md) for full task-by-task breakdown and implementation details across Phase 0 (Security Hardening), Phase 1 (E2E Verification), Phase 2 (FRD Completion), and Phase 3 (Release Readiness).

---

## 0. Security Hardening & Pre-Release Checklist (Branch: `feat/security-hardening`)

### Recently Fixed (`ce53300`, `c2d3088`)
- [x] **Optional MFA (TOTP + Email)** (`c2d3088`): Free-choice second factor (authenticator app or 5-minute emailed verification code via BCL `System.Net.Mail`), brute-force lockout on verification attempts, rate limiting on setup/disable endpoints, and zero forced-gate blocker on PlatformAdmin.
- [x] **HeaderClock & Domain Timezone Alignment** (`c2d3088`): Replaced 30-second interval layout timer with isolated 1 Hz `HeaderClock` component; domain default for `Clinic.Timezone` aligned to `Asia/Kolkata`.
- [x] **Rate limiting bypass**: Loopback no-limiter is now strictly conditioned on `IsDevelopment()`, preventing throttling bypass behind reverse proxies.
- [x] **Brute-force lockout**: `AuthController.Login` increments `FailedLoginCount` and enforces 15-minute lock after 5 consecutive failures before password validation.
- [x] **Duplicate OpenAPI**: Cleaned duplicate `AddOpenApi()` in `Program.cs`.

### Phase 0 — Security (🔴 Blocking — Current Sprint)
- [x] **[CRITICAL — A02] JWT Key Rotation & Git History Purge**: Purged `backend/Hospital_CRM.Api/keys/jwt-private.pem` from all Git history via `git-filter-repo`; verified zero occurrences in commit graph. Clean `origin` remote restored.
- [x] **[HIGH — A01/A09] Least-Privilege DB User**: Provisioned `scripts/setup-least-privilege-db.sql` for `app_user` with table/sequence CRUD and append-only audit protections.
- [x] **[HIGH — Secrets] Externalize Secrets**: Removed misleading HMAC key from `appsettings.Development.json`; completed `.env.example` with comprehensive reference variables.
- [x] **[HIGH — A07] Fix Account Enumeration**: Unified `AuthController.Login` to return generic 401 `invalid_credentials` for locked accounts.
- [x] **[MEDIUM — A06] Vulnerability Patching**: Upgraded `System.Security.Cryptography.Pkcs` and `System.Security.Cryptography.Xml` to `10.0.13` (GHSA-2fmv-rv2c-59x7 resolved).
- [x] **[MEDIUM — A02/A05] JWT Algorithm Pinning & Cookie Security**: Pinned `ValidAlgorithms = ["RS256"]`; configured `UseForwardedHeaders`; enforced `Secure` cookies.

---

## 1. Pilot launch configuration (not code — vendor/portal setup)

- [x] **OpenIddict Identity Center**: In-house OIDC server configured (.NET 10, OpenIddict, PKCE, JWKS discovery). Replaces external Azure Entra dependency with full self-hosted identity center; zero vendor lock-in.
- [ ] **SMTP Mail Relay**: Currently running in Development mode (which logs email verification codes to standard output with `[DEV EMAIL]`). For staging/production, configure `Smtp:Host`, `Smtp:Port`, `Smtp:Username`, `Smtp:Password`, and `Smtp:From` environment variables for real email delivery.
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

- [ ] **Mobile app build**: React Native Android APK rebuild needed to pick up the Two-Factor Authentication card in settings and the HeaderClock synchronization fix.
- [ ] **FR-22 offline sync**: client-side idempotency keys for registration/billing exist; full IndexedDB queue not built.
- [ ] **Platform Admin Tier-2 features**: the tenant list *and* the impersonation/flag endpoints **are** built (`PlatformAdminController`: `GET tenants`, `GET tenants/{id}`, `PATCH tenants/{id}`, `GET/PATCH tenants/{id}/flags`, `POST tenants/{id}/impersonate`, `POST impersonations/{id}/end`, `GET impersonations`), and a console page exists at `/dashboard/platform-admin`. What is *not* built: tenant provisioning (`POST tenants`), subscription/tier **enforcement** (status is stored but nothing acts on it), and a working module gate — see `Platform-Admin-Master-TODO.md` A3/A4/B3. This line previously claimed the endpoints did not exist.
- [ ] **Razorpay refund API** — Track 2b TODO at `PharmacyPosController.cs:264` (ProcessReturn currently processes database return & stock restoral; Razorpay external gateway refund call pending API credentials).
- [ ] **Voice Agent (MOD-27)** — Phase 3 per FRD-Phase2 §9.
- [ ] **UAE/international payment adapter** — India-only adapters per scope.
- [ ] **Dedicated DB/instance tenancy** — Tier-2+.

## 4. Documentation follow-ups

- [x] **`AGENTS.md` stale paths** — fixed 2026-10-02: Phase 1 FRD → `docs/product/FRD_FINAL.md`, `TOOLING-SETUP.md` → `docs/technical/TOOLING-SETUP.md`, `samstack-implementation-reference.md` marked never-created with in-code pattern pointers; "Pharmacy out of scope" claim corrected (core shipped).
- [x] `agents/state/known-limitations.md` — #3 pharmacy, #4 free-text Rx, #7 MOD-14 pending: all corrected to reflect shipped reality.
- [x] `agents/state/context.md` — "6 of 11 modules" header + wrong artifact-map paths fixed; last-verified 2026-10-02.
- [x] `CLAUDE.md` / `README.md` / `FRD-Phase-2-FINAL.md` — same stale paths corrected.

## 5. Out of scope (do not build without FRD change)

Pharmacy Track 2 remainder, AI features (Track 3), IPD (Track 4), regulated AI/CDSS — per FRD §5.2.
