# Platform Admin & Commercialisation Roadmap

> **Status:** DRAFT — for review. No code changes until approved.
> **Branch:** `feat/security-hardening`
> **Aligns with:** `docs/technical/Future-Implementations.md` (Gates 1–6, Tenancy Tiers 1–3), `TODO.md`, `Pending Works.md`, `docs/product/FRD_FINAL.md` §MOD-14 (FR-14-01…04)
> **Scope rule:** Phase A completes MOD-14 (already shipped scope, currently broken). Phases B/C open Gates 3–5, which `Future-Implementations.md` §1 explicitly gates behind Phase 1 pilot proof.

---

## 1. Purpose

Answers four questions:

1. Why the Platform Admin page does not open, and what exactly is broken.
2. What "give PlatformAdmin access to configure everything" concretely means.
3. How the product is sold and delivered to a client, and how all of it is inspected.
4. In what order we build it — smallest revenue-producing step first.

---

## 2. Verified current state

### 2.1 What already exists (do not rebuild)

| Component | Location | State |
|---|---|---|
| Platform Admin API | `PlatformAdminController.cs` — `api/v1/platform-admin`, 8 endpoints | Built |
| Subscription model on tenant | `Clinic.cs:97-100` — `SubscriptionTier`, `SubscriptionStatus`, `ActivatedModules`, `SubscriptionEndsAt` | Built |
| Subscription enums | `SubscriptionEnums.cs` — `Trial/Starter/Professional/Enterprise/Suspended`, `Active/PastDue/Cancelled/Suspended` | Built |
| Per-tenant feature flags | `TenantFeatureFlag` entity + `GET/PATCH tenants/{id}/flags` | Built |
| Module gate (enforcement) | `PharmacyDtos.cs:20-40` `IsPharmacyEnabledAsync`, called by `PharmacyPosController:33` and `PharmacyComplianceController:41` | Built, **mis-keyed (PA-3)** |
| Impersonation + audit trail | `ImpersonationLog`, `POST impersonate`, `POST impersonate/{id}/end`, `GET impersonations` | Built |
| Tenant branding + locale + rules | `Clinic.cs:11-94` (logos, 3 colours, timezone/currency, 10 appointment rules, 4 queue rules, billing defaults) | Built |
| Frontend page + route + nav | `PlatformAdmin.tsx`, `App.tsx:90`, `DashboardLayout.tsx:183-188` | Built, **crashes (PA-2)** |

### 2.2 What is broken

**PA-1 — No PlatformAdmin account exists in any database that already has users. 🔴 Blocker**
- `Program.cs:297-303`: `SeedDevelopmentDataAsync` runs only `if (!await db.Users.AnyAsync())`.
- The PlatformAdmin user is created *inside* that function (`Program.cs:571-583`).
- The repo already has the correct idempotent top-up pattern for a role added later — Pharmacist, at `Program.cs:306` (`!await db.Users.AnyAsync(u => u.Role == UserRole.Pharmacist)`) — but **no equivalent for PlatformAdmin**.
- **Effect:** `platform-admin@samstack.ai` is never created on an existing database → login fails → `/dashboard/platform-admin` is unreachable. This is the primary "not opening".

**PA-2 — The console page crashes on render. 🔴 Blocker**
- `Clinic.ActivatedModules` is a `string` (`Clinic.cs:99`, value `"core"`).
- `PlatformAdminController:46` returns it raw → JSON **string**.
- `PlatformAdmin.tsx:12` types it `string[] | null`; `PlatformAdmin.tsx:136` calls `.map()`.
- **Effect:** `TypeError: t.activatedModules.map is not a function` as soon as ≥1 tenant exists → blank page.

**PA-3 — The feature-flag toggle is a no-op, and pharmacy cannot be enabled. 🔴 Blocker**
- Console **writes** flags keyed by **`Clinic.Id`**: `PlatformAdminController:201-221` (`f.TenantId == id`, where `id` is the clinic id returned by `ListTenants` at `:42`).
- Enforcement **reads** a hardcoded **`Guid.Empty`**: `PharmacyDtos.cs:20-24` (`var tenantId = Guid.Empty;` then `f.TenantId == tenantId`).
- No seeder creates a pharmacy flag (verified across `backend/**/*.cs`).
- `IsPharmacyEnabledAsync` also *creates* a disabled flag as a side effect when missing (`PharmacyDtos.cs:25-38`).
- **Effect:** on a fresh database, `PATCH tenants/{id}/flags/pharmacy` reports success and the flag is visible in the console, but pharmacy dispense/POS still returns 403 `pharmacy_feature_disabled`. A shipped feature that cannot be switched on, and a control that silently lies.

**PA-4 — Suspension and subscription expiry are not enforced. 🟠 High**
- `SubscriptionStatus` / `SubscriptionTier` are only read and written by `PlatformAdminController` (`:45, :67, :84-86`); they are stored on `Clinic` and **read nowhere else** in the backend (verified by grep).
- `SubscriptionTier.Suspended` is documented as *"admin-set, blocks tenant logins"* (`SubscriptionEnums.cs:9`) — nothing blocks.
- **Effect:** you cannot cut off a non-paying client, and a `Trial` never expires.

**PA-5 — The console cannot provision anything. 🟠 High**
- `PlatformAdminController` exposes 8 endpoints: list, detail, patch, impersonate, impersonate-end, impersonations, flags-get, flags-patch. There is **no `POST tenants`** and no "create the tenant's first ClinicAdmin".
- **Effect:** onboarding customer #1 today is manual SQL.

**PA-6 — The UI covers ~15% of the API it already has. 🟠 High**
- `PlatformAdmin.tsx` (155 lines) calls only `GET /platform-admin/tenants`.
- Unwired: tenant detail, `PATCH tenants/{id}`, flags get/patch, impersonate, impersonations.
- **Effect:** even once PA-1/PA-2 are fixed, the page is a read-only table.

**PA-7 — Documentation is factually stale. 🟡 Medium**
- `Pending Works.md:48` states platform-admin impersonation/flags endpoints are *"deliberately not built"*. They are built and, for flags, broken per PA-3.
- **Effect:** the next planning round will make decisions from a false premise.

### 2.3 Root cause behind PA-3 and PA-4: two different definitions of "tenant"

| Where | Key used as "the tenant" |
|---|---|
| `PlatformAdminController` (list, detail, patch, flags) | **`Clinic.Id`** |
| `PharmacyCommon.IsPharmacyEnabledAsync` (enforcement) | **`TenantId`**, hardcoded to `Guid.Empty` |
| Seed (`Program.cs:491`, `:563`, `:579`) | `TenantId = Guid.Empty` on the clinic and all users |

Nothing defines the invariant, so two subsystems disagree about what a tenant *is*. `Clinic` carries both `Id` and `TenantId`, and `tenant_id` (per AGENTS.md) is deliberately dormant — but MOD-14 was built on top of it anyway, which is why the flag loop is broken.

**This decision must be made before any further tenancy work** (flags, isolation, billing, suspension), or every subsequent feature inherits the ambiguity.

---

## 3. The commercial model

The existing docs already define the tiers and gates (`Future-Implementations.md` §1–2). Map the sales models onto them rather than inventing a parallel scheme:

| Sales model | Doc tier | Gate | What must be built | Recommendation |
|---|---|---|---|---|
| **1. Subscription SaaS — small clinics** | Tier 1: Shared SaaS, single PostgreSQL, `tenant_id` + RLS | Gate 3 | Tenant identity fix, provisioning, self-serve signup, Razorpay Subscriptions, dunning | **Start here** |
| **2. Subscription + DB on the client's own system** | Tier 3: Customer VPC / on-prem | Gate 5 | Licence + activation, offline grace, upgrade path, opt-in telemetry, support access, deployment template | Only against a signed deal |
| *(new)* 3. Dedicated DB, we host it | Tier 2: Enterprise, isolated PostgreSQL per hospital, shared gateway | Gate 4 | Per-tenant DB routing + migration orchestration | Cheap middle step; natural upsell from Tier 1 |

**Additional commercial levers (process, not architecture):**

- **One-time deployment / onboarding fee + annual AMC.** Standard in hospital procurement and often the only line item hospitals can actually approve. Add from day one — it costs nothing to build.
- **Seat-based pricing** (per doctor / per bed) layered on the tiers. Flat tiers cannot price a 3-doctor clinic against a 30-doctor hospital fairly.
- **White-label / reseller.** Already ~free: `Clinic.LogoUrl`, `DarkLogoUrl`, `LightLogoUrl`, `FaviconUrl`, `PrimaryColor`, `SecondaryColor`, `AccentColor` (`Clinic.cs:48-67`).
- **Hybrid managed-DB** (app in the client's VPC, database we operate) for data-residency requirements (India DPDP / UAE PDPL).

**Ordering recommendation:** land model **1** first, manually provisioned initially. Add the deployment fee + AMC immediately. Take **2** and **3** only when a specific contract requires them.

---

## 4. Roadmap

### Phase A — Make the operator console actually work (P0)

*Completes MOD-14. No new scope. Everything here is fixing shipped-but-broken code.*

| # | Task | Targets | Why |
|---|---|---|---|
| A1 | PlatformAdmin top-up seed, mirroring the pharmacist pattern at `Program.cs:306` | `Program.cs` | Unblocks login (PA-1) |
| A2 | Fix the `ActivatedModules` contract — split to an array server-side | `PlatformAdminController:46, 68, 102` | Stops the render crash (PA-2) |
| A3 | **Decide the tenant identity invariant** (§2.3) and align both ends of the flag key | `PharmacyDtos.cs:20-24`, `PlatformAdminController`, data migration | Makes the toggle real (PA-3) |
| A4 | Wire tenant detail + `PATCH tenants/{id}` into the page (tier, status, modules, ends-at) | `PlatformAdmin.tsx` | Config surface (PA-6) |
| A5 | Wire feature-flag toggles into the page | `PlatformAdmin.tsx` | Config surface |
| A6 | Wire impersonation + an impersonation-log view | `PlatformAdmin.tsx` | **This is the "inspect everything" tool** |
| A7 | Enforce suspension + subscription expiry at login | `AuthController`, `SubscriptionEnums` | Makes commercial control real (PA-4) |
| A8 | Correct the stale `Pending Works.md:48` | `Pending Works.md` | Stop the next round planning on a false premise |

**Definition of done**
1. Log in as `platform-admin@samstack.ai`.
2. Tenants render with correct module badges.
3. Open a tenant → change tier, status, modules, expiry → persist.
4. Toggle `pharmacy` off → a real dispense call returns 403; toggle on → it succeeds. *(The test that proves PA-3 is dead.)*
5. Suspend a tenant → that tenant can no longer log in.
6. Impersonate a clinic user → the action appears in the impersonation log.
7. Impersonation is refused for a non-PlatformAdmin token.

**Risk:** A3 is the only task here that touches existing data. If the invariant is "a tenant owns ≥1 clinic", the missing piece is a `Tenant` row, not just a value — scope that explicitly and separately.

---

### Phase B — Make it sellable (Tier 1 / Gate 3)

| # | Task | Notes |
|---|---|---|
| B1 | `POST /platform-admin/tenants` — provision Tenant + Clinic + first ClinicAdmin + default flags + tier + trial expiry | The single biggest onboarding gap (PA-5) |
| B2 | Decide manual provisioning vs self-serve signup for the first ~5 customers | Manual is cheaper and fine until support cost hurts |
| B3 | Subscription billing via Razorpay Subscriptions/Plans | ⚠️ Current Razorpay wiring is for **patient** invoices only (`InvoicesController`). Nothing bills the clinic today. This is net-new. |
| B4 | Dunning: `PastDue` → grace → auto-suspend, driven by `SubscriptionEndsAt` | Depends on A7 |
| B5 | **Tenant isolation:** activate `tenant_id` via EF global query filters + backfill + PostgreSQL RLS | **Largest change in this roadmap.** Own branch, own migration plan, own full test pass. Do not let it ride along with console work. |
| B6 | Onboarding runbook + one dry-run with a real clinic | Proves the whole path |

**Gate note:** `Future-Implementations.md` §1 gates Gate 3 behind Gate 2 (3–5 live clinics, >80% digital OPD volume). B1–B4 can be built ahead of that; **B5 should not start** until B1–B4 are proven, because it re-touches every query.

---

### Phase C — Enterprise tracks (only against a signed deal)

| # | Task | Notes |
|---|---|---|
| C1 | Tier 2 — dedicated PostgreSQL per hospital, shared gateway | Per-tenant connection resolution + migration orchestration |
| C2 | Tier 3 — dedicated full stack (containers, DB, cache) per enterprise | Deployment template (compose → Kubernetes) |
| C3 | On-prem licence + activation + offline grace | Only build when a contract requires it |
| C4 | Support access for on-prem deployments | Impersonation cannot phone home — needs signed log export or a support tunnel |

---

## 5. Delivering to a client and inspecting everything

**Preconditions before any client sees a deployment**

1. 🔴 **`TODO.md` 0.1 — rotate the JWT RS256 key and purge it from Git history. Still open.** A client deployment signing tokens with a key that exists in public Git history is a complete authentication bypass (any role, including platformadmin).
2. 🔴 **`TODO.md` 1.4 — `docker compose up -d` end-to-end validation. Still open.** This is the delivery mechanism and it has never been verified this session.
3. Externalise all config to environment variables / Key Vault — connection string, `AzureStorage__ConnectionString` (Azurite → real Azure Blob), Razorpay, WhatsApp, JWT key.
4. Confirm `Database:EraseOnStartup` is unset outside Development (it is dev-guarded — keep it that way) and that no seeded password ships.

**Deployment shape:** `postgres + api + frontend` behind TLS, config by environment, **pinned image tags** (you need reproducible versions to support a client).

**Handover pack per client:** admin credentials + forced first-login change, tenant configuration summary, backup/restore procedure, data-residency statement, support contact.

**Inspection:** Platform Admin console (tenants, tiers, modules, flags) + impersonation, which is **audit-logged** via `ImpersonationLog` — traceable support access is exactly what a hospital compliance officer will ask for.

---

## 6. Explicitly deferred (proposed — confirm)

- Licence key generation, activation servers, offline enforcement (Phase C only).
- Per-bed / usage metering and automated billing engines.
- Reseller portal and multi-brand provisioning beyond the existing `Clinic` branding fields.
- Marketplace / payment-service-provider integrations.
- Multi-region and multi-currency beyond `Clinic.Currency`.
- Full self-serve signup, until manual onboarding becomes the bottleneck.

---

## 7. Decisions needed from you

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Tenant identity invariant** — is `TenantId` the organisation (owning N clinics) or is it equal to `Clinic.Id`? | Tenant = organisation, Clinic = facility. Platform Admin addresses tenants by `TenantId`, never `Clinic.Id`. Single-clinic customers get a Tenant row whose id equals the clinic's `TenantId`. Keeps `tenant_id` meaningful for hospital groups. |
| D2 | Which sales model to design for first? | Tier 1 (shared SaaS). |
| D3 | Manual provisioning or self-serve signup for the first customers? | Manual + invoice. Build self-serve once support cost justifies it. |
| D4 | Suspension semantics — hard block, or read-only grace then block? | Read-only grace (7 days) then full block. Clinics hate losing read access to patient records mid-treatment. |
| D5 | Does the A3 tenant-identity fix land **before** the first pilot, or after? | Before. It is small now and touches every feature later. |
| D6 | Do `Trial/Starter/Professional/Enterprise` match your commercial tiers and pricing? | Confirm or rename before they appear on invoices. |

---

## 8. Verification gates

| Gate | Requirement |
|---|---|
| Phase A done | The 7-point definition of done in §4, plus `dotnet build` / `npm run build` / `dotnet test` green |
| Phase A → B | PA-3 proven with a real 403→200 dispense call, not just a UI toggle |
| Phase B → pilot | Tenant #1 provisioned end-to-end through the console, no manual SQL |
| Phase B → C | B5 isolation shipped with a regression test proving cross-tenant reads are impossible |
| Phase C → client | JWT key rotated, `docker compose` validated, handover pack complete |

---

## 9. What I did not verify

- I did not run the app to reproduce the PA-2 render crash live; the `string` vs `string[]` mismatch between `Clinic.cs:99` and `PlatformAdmin.tsx:136` is unambiguous, but it has not been observed.
- PA-4 is a negative finding (no enforcement found by grep). Absence of evidence is strong here but not proof; A7 should start by re-confirming.
- I have not read `docs/technical/TRD_Phase1.md` / `TRD-Phase2-V1.md` in full, so there may be tenancy design already written down that D1 should follow instead of my recommendation.
