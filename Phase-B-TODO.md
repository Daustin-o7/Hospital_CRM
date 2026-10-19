# Phase B — Build TODO (B2–B6)

Created 2026-10-19 22:40. Supersedes nothing; `Platform-Admin-Master-TODO.md` §3 remains the requirement text, this file is the build order and the findings.

**Verified state at creation:** `dotnet build` green · `dotnet test` **153 passed / 0 failed** · frontend builds.

---

## 0. Situation — read first

A **second writer worked in `backend/` between 21:44 and 21:56** while this session was doing A5 work (last write `Services/TenantContext.cs` 21:56:52, idle since). It implemented most of **B1**. Files it created/changed: `Domain/Services/ITenantContext.cs`, `Api/Services/TenantContext.cs`, `Infrastructure/Interceptors/TenantConnectionInterceptor.cs`, migrations `20261019160000_BackfillTenantIdToActiveTenant` + `20261019170000_EnableRowLevelSecurityForTenants`, and edits to `HospitalCrmDbContext`, `Program.cs`, `InvoicesController`, `AppointmentsController`, `StaffController`, `PharmacyCatalogController`.

Compile of the runtimes the other writer added: `ITenantScoped` marker, EF global query filter (`BypassTenantFilter || e.TenantId == CurrentTenantId`), `EnforceTenantScopedInserts()` on save, RLS policies for 28 tables driven by `SET app.current_tenant_id` / `SET app.is_platform_admin`, and `TenantContext.PushTenant()` for background jobs.

**Consequence for this plan:** B1 is *not* mine but it is the foundation B2/B3 sit on, and it left defects that block them — see §1. I will not rewrite B1; I will fix only what B3 cannot work without.

---

## 1. Blockers found by re-reading the tree (all verified)

| # | Finding | Evidence | Blocks |
|---|---|---|---|
| **F1** | **An invited user is locked out of the entire app.** `accept-invite` creates the `User` with `ClinicId` but **never `TenantId`**. `User` is not `ITenantScoped`, so the insert hook does not fill it either. That user's JWT therefore has no `tenant_id` claim → `CurrentTenantId` is null → the query filter matches `Guid.Empty` → **0 rows**; and RLS (`"TenantId" = NULLIF(current_setting(...),'')::uuid`) evaluates null = null → **0 rows at the DB too**. | `StaffController.cs:118-128` (no TenantId), `User.cs:9` (nullable, not ITenantScoped), `HospitalCrmDbContext.cs:101-102`, RLS migration `:59-66` | **B3 (fatal)**, FR-04, any invite onboarding |
| **F2** | 11 `TenantId = Guid.Empty` **writes** survive in `InventoryController` (6), `LabOrdersController` (3), `LedgerController` (1), `ShiftsController` (1); 1 `Guid.Empty` **read predicate** remains. The insert hook only fires when a tenant context exists, so these now write `Guid.Empty` and RLS then hides them from their own tenant. | grep over `Controllers/*.cs` | B1 completion |
| **F3** | `TenantConnectionInterceptor` uses `SET`, not `SET LOCAL`, on a **pooled** connection. It re-runs on every `ConnectionOpened`, so a leak needs a window between open and first query — but the requirement text explicitly says per-transaction `SET LOCAL`. | `TenantConnectionInterceptor.cs:41`, `:57`, Master TODO §3 B1 | B1 completion |
| **F4** | `NotificationRulesWorker` hardcodes `var tenantId = Guid.Empty;` and filters rules by it, so no tenant's rules ever fire. | `Services/NotificationRulesWorker.cs:58,61` | B2 (WhatsApp per tenant) |
| **F5** | `Payment` has **no `TenantId`** and is not `ITenantScoped` → RLS cannot cover it and it is reachable by id across tenants. Same for `InvoiceLineItem` and `NotificationLog`. | `Payment.cs:7-28`, `InvoiceLineItem.cs`, `NotificationLog.cs` | B2, B1 | 
| **F6** | The Razorpay branch of `CollectPayment` never sets `RazorpayPaymentId` and never creates a Razorpay order, but the webhook looks payments up **by** `RazorpayPaymentId` → a webhook can never match a payment created through the app; only the 60-min polling reconciler can. | `InvoicesController.cs:143-160`, `:216` | B2 (Razorpay optional), B4 |
| **F7** | FR-04 says the invited role cannot be `ClinicAdmin`, but the backend only rejects `PlatformAdmin`; `Enum.TryParse` also accepts `"0"` → ClinicAdmin (same class of bug as the A4 enum hole already fixed). | `StaffController.cs:41`, `FRD_FINAL.md:235` | B3 (provisioning must mint a ClinicAdmin invite) |
| **F8** | Invite expiry is 7 days in code, 72 hours in FRD FR-04. | `StaffController.cs:59` vs `FRD_FINAL.md:230` | B3 |

**F1 is the important one.** B3's Done-when is "invite accepted, tenant provisioned end to end" — that is currently impossible.

---

## 2. Pending on you (I cannot do these here)

| Need | For | Why I can't |
|---|---|---|
| Android bridge scope decision | B2 | new client surface; `MobileApp/` **does not exist** (AGENTS.md references it but it is absent) |
| Paytm Business / PhonePe Business webhook credentials + secret | B2 | merchant account |
| A signed contract pack (MSA/DPA/SLA) | P0-5, B5 | legal |
| D4 clause + D7 confirmation in the DPA | B2, B4 | legal |
| Razorpay account, test-mode keys, accountant sign-off on GST invoices | B4 | account + accountant |
| A real clinic willing to do the dry run | B5 | external |
| A machine with Docker | P0-2 | Docker not installed here |
| A CI pipeline to host gitleaks | P0-1 remainder | there is no `.github/` at all |

---

## 3. Build order

### Step 1 — B3 prerequisites (must be first; B3 is otherwise impossible)
- [ ] **B3.0a** `accept-invite` sets `User.TenantId` from `StaffInvite.TenantId` (and backfills any existing null-tenant user). *(F1)*
- [ ] **B3.0b** `StaffInvite.TenantId` set explicitly on create instead of relying on the ambient hook. *(F1)*
- [ ] **B3.0c** Reject out-of-range/numeric roles on invite; allow `ClinicAdmin` **only** from the provisioning endpoint, keep FR-04 for the normal path. *(F7)*
- [ ] **B3.0d** Align invite expiry with the FRD (72 h) or record the deviation. *(F8)*
- [ ] Tests: invited users can read their own tenant and only their own tenant.

### Step 2 — B3 `POST /platform-admin/tenants` (M)
- [ ] Transactional create: `Tenant` + `Clinic` (real `TenantId`) + `ActivatedModules` + default `TenantFeatureFlag` rows + tier/status/`SubscriptionEndsAt` + first `ClinicAdmin` as a pending invite.
- [ ] Idempotent via `X-Idempotency-Key`; a retry returns the first result and creates exactly one tenant. *(the existing `IdempotencyMiddleware` is memory-only — acceptable for a platform-admin call, but the durable path is a `ProvisioningRequest` row keyed by the header; decide in implementation)*
- [ ] No password generated or sent; single-use invite link only.
- [ ] Console UI: "Provision tenant" form.
- [ ] Done-when: retried request → one tenant; tenant #2 provisioned with no manual SQL; invite link single-use.

### Step 3 — B2 per-tenant integrations (M)
- [ ] **B2.1** `TenantIntegration` entity (`ITenantScoped`) for per-tenant provider credentials: provider, merchant/vpa id, encrypted secret, webhook path token, enabled, last-verified-at. *(needs the encryption decision)*
- [ ] **B2.2** Generic webhook receiver `POST /api/v1/webhooks/payments/{provider}/{pathToken}`, HMAC-verified per tenant, resolving the tenant from the path token + signature — **not** from a claim. *(Done-when: tenant A's webhook cannot be processed under tenant B's secret.)*
- [ ] **B2.3** Persisted processed-event dedupe so a re-delivered webhook is idempotent (the Razorpay handler is status-based only today). *(F5-adjacent)*
- [ ] **B2.4** Match an inbound payment to an open invoice (amount + window + optional UTR/reference) and close it; unmatched → a review queue rather than a silent drop.
- [ ] **B2.5** Manual "Mark as Paid" + optional **UTR** field on `Payment`. *(no reference field exists today)*
- [ ] **B2.6** Clinic Admin "Connect payment account" screen + **Test connection**; secret never returned by any API.
- [ ] **B2.7** `Payment.TenantId` (+ backfill) so RLS covers payments. *(F5)*
- [ ] **B2.8** Fix `CollectPayment`'s Razorpay branch to actually create an order and store `RazorpayPaymentId`. *(F6)*
- [ ] **B2.9** Android notification bridge — **scope decision pending**; backend ingest contract only, or also the device app.
- [ ] **B2.10** Per-tenant WhatsApp sender + template approval state; fix `NotificationRulesWorker`'s hardcoded tenant. *(F4)*
- [ ] Done-when: A's webhook can't be processed under B's secret; a payment to a clinic's own PSP auto-closes the invoice; manual mark-as-paid + UTR reconciles; secrets never in a response or log.

### Step 4 — B4 Razorpay subscription billing (L)
- [ ] Verify Plans/Subscriptions against **live** Razorpay docs before writing.
- [ ] Signature-verified, idempotent webhooks driving the A4 state machine (`SubscriptionPolicy`).
- [ ] Dunning: PastDue → 3-day ReadOnly (D3) → Suspended.
- [ ] SAMSTACK's own GST invoice lines (accountant sign-off).
- [ ] Done-when: trial → paid → past due → suspended → reactivated in test mode, end to end.

### Step 5 — B5 runbook + dry run (S)
- [ ] Write the runbook (contract signed → tenant provisioned → invite accepted → first booking < 30 min).
- [ ] Dry run **blocked** on a real clinic.

### Step 6 — B6 self-serve signup
- [ ] Still deferred by D8. Record the trigger condition (manual onboarding is the bottleneck) rather than build.

### Step 7 — B1 leftovers (not mine, but they block the above)
- [ ] F2: the 11 `Guid.Empty` writes + 1 read predicate.
- [ ] F3: `SET` → `SET LOCAL` per transaction.
- [ ] Verify: A's token against B's resource id → **404 not 403**; a raw SQL query as `app_user` with no tenant context returns 0 rows; a job for A never touches B.

---

## 4. Definition of done for this file

Every box above ticked, or explicitly moved to §2 with the reason. Each B item's own Done-when in `Platform-Admin-Master-TODO.md` §3 is the acceptance test — no passing test, not done.
