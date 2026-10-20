# Phase B — Build TODO (B2–B6)

Created 2026-10-19 22:40 · **Updated 2026-10-20** after B2/B3/B4 were built and
verified against a running API and the dev database.
`Platform-Admin-Master-TODO.md` §3 remains the requirement text; this file is the
build order, the findings and the evidence.

**State at this update:** `dotnet build` green · `dotnet test` **194 passed / 0 failed**
· frontend builds · Android app compiles (`:app:compileDebugJavaWithJavac` BUILD
SUCCESSFUL). Branch: `feat/platform-commercialisation` (cut from `main` after
`feat/platform-admin-console` was merged and pushed).

---

## 0. Situation — read first

A **second writer worked in `backend/` between 21:44 and 21:56** while this session
was doing A5 work (last write `Services/TenantContext.cs` 21:56:52, idle since). It
implemented most of **B1**. Files it created/changed: `Domain/Services/ITenantContext.cs`,
`Api/Services/TenantContext.cs`, `Infrastructure/Interceptors/TenantConnectionInterceptor.cs`,
migrations `20261019160000_BackfillTenantIdToActiveTenant` +
`20261019170000_EnableRowLevelSecurityForTenants`, and edits to `HospitalCrmDbContext`,
`Program.cs`, `InvoicesController`, `AppointmentsController`, `StaffController`,
`PharmacyCatalogController`.

Compile of the runtimes the other writer added: `ITenantScoped` marker, EF global
query filter (`BypassTenantFilter || e.TenantId == CurrentTenantId`),
`EnforceTenantScopedInserts()` on save, RLS policies for 28 tables driven by
`SET app.current_tenant_id` / `SET app.is_platform_admin`, and
`TenantContext.PushTenant()` for background jobs.

---

## 1. Blockers found by re-reading the tree (all fixed unless noted)

| # | Finding | Status |
|---|---|---|
| **F1** | An invited user was locked out: `accept-invite` never set `User.TenantId`, and the anonymous accept then failed RLS on the `StaffInvites` update. | **Fixed.** `User.TenantId` set from the invite; accept runs in a transaction with `set_config(..., true)` + `PushTenant` so the `WITH CHECK` passes. Verified live. |
| **F2** | 11 `TenantId = Guid.Empty` writes and 1 read predicate. | **Fixed** for the 5 inventory + 2 lab-order + 1 ledger + 1 shift read predicates. Inserts were already corrected by the `EnforceTenantScopedInserts` hook; the shift-audit helper now takes the caller's tenant id instead of relying on that hook. |
| **F3** | `TenantConnectionInterceptor` used `SET`, never `SET LOCAL`. | **Fixed.** Connection open still sets the baseline (needed outside transactions); `TransactionStarted` now re-applies `SET LOCAL`. Verified that transactional webhooks still pass RLS. |
| **F4** | `NotificationRulesWorker` hardcoded `Guid.Empty`. | **Fixed.** Iterates tenants with `PushTenant`. |
| **F5** | `Payment` had no `TenantId`; not covered by RLS. | **Fixed.** Column + backfill + RLS policy. `InvoiceLineItem`/`NotificationLog` remain uncovered (noted, not needed by B2). |
| **F6** | Razorpay branch never created an order or stored `RazorpayPaymentId`. | **Fixed.** Real order creation; `503 razorpay_not_configured` when unset; webhook matches by payment id or order id. |
| **F7** | Invite accepted `"0"`/`PlatformAdmin`; `ClinicAdmin` not restricted. | **Fixed.** `StaffRolePolicy`; `ClinicAdmin` only via provisioning. |
| **F8** | Invite expiry 7 days vs 72 h in FR-04. | **Fixed.** 72 h. |
| **F9** | Entitlements were only enforced for pharmacy: wishlist, lab, inventory, finance and precheck answered every tenant, and the nav showed modules nobody had bought. | **Fixed.** Shared `RequireModuleAttribute` (ActivatedModules + feature-flag overrides), applied to wishlist/lab/inventory/ledger + the precheck endpoints; precheck links are only generated when the module is on; `/clinic/profile` returns `activatedModules`; nav and dashboards hide what is not entitled. Verified live: 403 `module_not_activated` on revoke, 200 after restore, nav hides/reappears. New `RequireModuleAttributeTests` (4 cases). |
| **F10** | Idempotency keys were global - the same key on another route or from another tenant replayed that other response - and 4xx responses were cached for 24 h. `GET /appointments` needed only authentication, so any role could list them. The nurse audit helper wrote `TenantId = Guid.Empty`. | **Fixed.** Cache key is `tenant:method:path:key`, only 2xx is replayed, middleware moved after `UseAuthentication`; appointment list restricted to Receptionist/Doctor/ClinicAdmin/Nurse; audit helper takes the caller's tenant. |
| **F11** | `/auth/refresh` with no credential returned 401, so every first visit logged a console error. Dev DB credentials were committed in `appsettings.json`. | **Fixed.** 204 when nothing was presented (401 still for a bad token); connection strings moved to user-secrets with a startup guard, documented in `AGENTS.md`. |

---

## 2. Pending on you (I cannot do these here)

| Need | For | Why I can't |
|---|---|---|
| Razorpay merchant account + test-mode keys + plan ids | B4 | no account; B4 is provider-agnostic and only the webhook half is exercised (see §4) |
| Accountant sign-off on SAMSTACK's GST invoices | B4 | external |
| Paytm Business / PhonePe Business webhook credentials | B2 | merchant account |
| A physical Android device with a bank SMS / soundbox | B2.9 | code compiles; runtime unverified |
| A signed contract pack (MSA/DPA/SLA) | P0-5, B5 | legal |
| D4 clause + D7 confirmation in the DPA | B2, B4 | legal |
| A real clinic willing to do the dry run | B5 | external; runbook is written |
| A machine with Docker | P0-2 | Docker not installed here |
| A CI pipeline to host gitleaks | P0-1 remainder | there is no `.github/` at all |

---

## 3. Build order — status

### Step 1 — B3 prerequisites ✅
- [x] **B3.0a** `accept-invite` sets `User.TenantId` and scopes the update so RLS accepts it.
- [x] **B3.0b** `StaffInvite.TenantId` set explicitly on create.
- [x] **B3.0c** `StaffRolePolicy`: numeric roles and `PlatformAdmin` rejected; `ClinicAdmin` only from provisioning.
- [x] **B3.0d** Invite expiry = 72 h.
- [x] Tests: `StaffRolePolicyTests`; live check that the invited admin sees only its tenant.

### Step 2 — B3 `POST /platform-admin/tenants` ✅
- [x] Transactional `Tenant` + `Clinic` + module flags + pending `ClinicAdmin` invite.
- [x] Idempotent through `X-Idempotency-Key`; retry returns the first response.
- [x] No password generated or sent; single-use 72 h invite.
- [x] Console "Provision tenant" form.
- [x] Done-when verified live (see §4).

### Step 3 — B2 per-tenant integrations (mostly ✅)
- [x] **B2.1** `TenantIntegration` + encrypted secret at rest (`ISecretProtector`).
- [x] **B2.2** Signed webhook receiver; tenant resolved from the path token, never a claim.
- [x] **B2.3** Persisted dedupe on (provider, event id).
- [x] **B2.4** Amount/reference matching; unmatched → review queue, never dropped.
- [x] **B2.5** Manual "Mark as Paid" + UTR.
- [x] **B2.6** Connect screen + Test configuration; secret never returned.
- [x] **B2.7** `Payment.TenantId` + backfill + RLS.
- [x] **B2.8** Razorpay order creation and webhook matching.
- [x] **B2.9** Android bridge **code** shipped: SMS receiver + notification listener → local queue → Capacitor `PaymentBridge` plugin → authenticated `POST /integrations/payments/bridge/notifications`. Compiles. **Device test still pending.**
- [~] **B2.10** Worker tenant bug fixed. Per-tenant WhatsApp sender/template-approval state **not built** — no BSP account and it was not in this session's scope.
- [x] Done-when verified live (see §4).

### Step 4 — B4 subscription billing (webhook half ✅, provider account pending)
- [x] Verified against the live Razorpay Subscriptions webhook docs (event names,
      `payload.subscription.entity`, unix-second `current_end`, raw-body signature).
- [x] `SubscriptionLifecycle`: provider → neutral event mapping + A4 transition; pure.
- [x] `POST /api/v1/webhooks/subscriptions/{provider}`: signature-verified, deduped
      (`X-Razorpay-Event-Id`), tenant from `notes.tenant_id`, `SET LOCAL` per transaction.
- [x] Dunning: PastDue keeps the paid period end, so A4 gives 3-day read-only then blocked.
- [x] Tests: mapping, ignore-list, full trial→paid→past due→suspended→reactivated cycle.
- [ ] **Plan/subscription creation against Razorpay** — needs account + keys. The
      subscription must be created with `notes.tenant_id`; that is a one-line addition
      when the account exists.
- [ ] GST-compliant invoice lines — accountant sign-off.
- [~] Done-when "runs end to end in test mode": the state cycle runs end to end
      against the real endpoint; the missing half is Razorpay creating the events.

### Step 5 — B5 runbook (written, dry run pending)
- [x] `docs/technical/Onboarding-Runbook.md`: contract → provision → invite → clinic
      setup → first booking inside 30 minutes, with verification and rollback.
- [ ] Dry run with a real clinic — external dependency.

### Step 6 — B6 self-serve signup — **deferred (D8)**
- [x] Trigger recorded rather than built. **Build B6 when** manual onboarding has been
      the bottleneck for two consecutive weeks: i.e. more than ~2 new clinics per week,
      or the runbook's 30-minute bar is missed because of provisioning/admin work
      rather than clinic-side setup. Prerequisites before B6: self-serve payment
      collection (B4 live), automated tenant provisioning (B3 is manual-by-design for
      the first ~5 clients), and an abuse/duplicate-account policy.

### Step 7 — B1 leftovers
- [x] F2 read predicates (inventory, lab orders, ledger).
- [x] F3 `SET LOCAL` per transaction.
- [x] Verified live: A's token cannot read B's rows; the webhook path still passes RLS
      after the interceptor change; invited admin sees 0 rows of the demo tenant.

---

## 4. Verification log (2026-10-20)

All of the following ran against `http://localhost:5000` and the dev PostgreSQL.

**B3**
1. `POST /platform-admin/tenants` twice with one `X-Idempotency-Key` → same `tenantId`,
   `SELECT count(*)` for that tenant = 1 (tenant total went 1 → 2).
2. `POST /staff/accept-invite` with the returned token → `invite_accepted`; the second
   attempt → `401 invalid_or_expired_invite` (single-use).
3. Login as the new admin → JWT contains `tenant_id`; `GET /patients` returns 0 rows
   while the demo tenant returns 46.

**B2**
4. `PUT /integrations/payments/paytm` → webhook URL; response has `hasSecret: true`
   and no secret value.
5. Signed `POST /webhooks/payments/paytm/{token}` → `{"status":"ok"}`; invoice went to
   Paid with a `Payment` row carrying `Utr` and the correct `TenantId`.
6. Replay → `{"status":"duplicate"}`. Wrong secret → `400 invalid_webhook_signature`.
   Tenant B's secret against tenant A's URL → `400`. Unknown token → `404`.
7. Wrong amount → `{"status":"unmatched"}`, visible in `GET /integrations/payments/unmatched`.
8. `POST /invoices/{id}/payment` with `method=cash, utr` → `status: paid`, UTR stored.
9. `POST /integrations/payments/paytm/verify` → `verified: true`.
10. No secret appeared in any response body or in the API logs.
11. Bridge: matched → `ok` + invoice paid; replay → `duplicate`; wrong amount → `unmatched`.

**B4**
12. Signed `subscription.activated` → `active` + new end date.
13. `subscription.pending` → `pastdue`, end date unchanged (paid period preserved).
14. `subscription.halted` → `suspended`.
15. `subscription.charged` → `active`, end date moved to the new period.
16. Replay of the same `X-Razorpay-Event-Id` → `duplicate`. Bad signature → `400`.
    No `notes.tenant_id` → `202 unresolved_tenant`.
17. Demo tenant's original billing state restored after the run; test rows removed.

---

## 5. Definition of done for this file

Every box above ticked, or explicitly moved to §2 with the reason. Each B item's own
Done-when in `Platform-Admin-Master-TODO.md` §3 is the acceptance test — no passing
test, not done.
