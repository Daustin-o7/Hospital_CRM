# Session Memory (`memory.md`)

This file captures per-session working memory — what was built, what's running, and what to pick up next time.

---

## Session: 2026-08-30 (Phase 2 Fast-Follow Push — ALL 9 SHIPPED)

### What Was Shipped This Session

**Phase 1 carry-overs (closed):**
- Persistent RS256 key management (PemFileKeyService + AzureKeyVaultKeyService) — ADR-07
- `IPostConfigureOptions<JwtBearerOptions>` to replace `BuildServiceProvider` anti-pattern — ADR-08
- `EnforceAppendOnlyAudit` migration (REVOKE UPDATE/DELETE on audit tables) — ADR-04 implementation
- `RazorpayReconciliationWorker` background service for FR-18 webhook-loss edge case
- `Payment.PaidAt` column migration

**Phase 2 modules (9 of 9 shipped — 100%):**
- ✅ **MOD-23 Pre-Check Form** — `PrecheckSubmission` entity, SHA256-hashed token, 2h lead-time skip, `POST /precheck/{token}` + `GET /appointments/{id}/precheck`, wired into booking transaction atomically — ADR-10
- ✅ **MOD-24 Emergency Queue** — `AppointmentPriority` enum, `PriorityLog` audit table, `PATCH /appointments/{id}/priority`, list sorts emergency-first
- ✅ **MOD-25 Live Ticket Tracking** — `GET /queue-status/{token}` (unauthenticated), filtered by doctor + date
- ✅ **MOD-12 Speciality EMR Templates** — `ConsultTemplate` entity with JSONB structure, 3 built-in seeded (Dental/General/Ayurveda per survey distribution 25%/17/17%), `GET/POST /consult-templates`
- ✅ **MOD-13 Notification Rules Engine** — `MessageTemplate` + `NotificationRule` entities, `NotificationLog.RuleId` nullable column preserves Phase 1 sends, `GET/POST /notification-rules` + `GET/POST /message-templates`, `NotificationRulesWorker` BackgroundService (5-min interval) — ADR-09
- ✅ **MOD-10 Wishlist** — `WishlistItem` entity, 4 categories (task/goal/equipment/expansion), 3 statuses, doctor-scoped
- ✅ **MOD-09 Inventory** — 3-tier catalog (dead/consumable/usable), append-only `StockMovement` with running balance derived, warn-don't-block on negative balance, low-stock report
- ✅ **MOD-08 Lab Records** — `LabOrder` linked to consultation, versioned `LabResult` (same amendment pattern as consultations), file upload to local disk `lab-uploads/` (S3 swap per TRD-Phase2 §3)
- ✅ **MOD-11 Finance Ledger** — `LedgerExpense` with 10 fixed categories, income read from `payments` table (no separate table → reconciliation guarantee), monthly summary
- ✅ **MOD-14 Platform Admin Portal** — new `PlatformAdmin` role + seeded `platform-admin@samstack.ai`, `Clinic.SubscriptionTier/Status/ActivatedModules`, `ImpersonationLog` audit, `TenantFeatureFlag` — security boundary tested (clinic admin gets 403)
- **Phase 1 FR-20/21 migration to MOD-13** — seeded as default `appointmentconfirmation` + `appointmentreminder` rules

**Bugs caught and fixed mid-session:**
- `PrecheckReviewController` was nested in `PrecheckController.cs` with two class-level `[Route]` attributes causing case-sensitive routing. Extracted to own file with direct lowercase route — ADR-11
- `DateTimeOffset` with non-UTC offset in `PrecheckSubmission.ExpiresAt` → wrapped with `new DateTimeOffset(slotDateTime, TimeSpan.Zero)` for Npgsql compatibility
- `RazorpayReconciliationWorker` was registered as hosted service (singleton) consuming scoped `HospitalCrmDbContext` → switched to `IServiceScopeFactory`
- `DateOnly.ToDateTimeOffset()` doesn't exist → switched to `DateOnly.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)` for ledger month boundaries
- `PhysicalFileProvider` requires directory to exist at construction → `Directory.CreateDirectory` before `UseStaticFiles` for lab-uploads

### Current Server State

- **Running**: dotnet process on `http://localhost:5000`, PID varies
- **Database**: PostgreSQL with `app_user` role (REVOKE UPDATE,DELETE on audit tables), all migrations applied
- **Seed data**: clinic, 4 users (admin/doctor/reception/platform-admin), 3 patients, appointments, working hours, 3 consult templates, 2 message templates, 2 notification rules, 1 clinic with Professional tier + all 8 modules activated, 2 feature flags (lab_records, inventory), 1 impersonation log (start+end)

### What's Next (Post-Phase-2)

**No remaining modules.** Per FRD-Phase2 §9, **Voice Agent (MOD-27a + 27b)** is formally Phase 3.

The next team-level work is **pilot launch prep** (real vendor configuration, not code):
1. WhatsApp Meta/BSP account + template approval submission
2. Razorpay merchant account + webhook secret
3. Azure Entra External ID tenant + role claim mapping
4. S3-compatible blob storage for MOD-08 (currently local disk)

### Useful Patterns Established This Session

- **Module entity pattern**: entity in `Domain/Entities/`, DbSet + configuration in `Infrastructure/Data/HospitalCrmDbContext.cs`, controller in `Api/Controllers/`, service worker in `Api/Services/` if background
- **Phase 1 single-tenant**: use `Guid.Empty` as tenantId everywhere (dormant column, no claim)
- **Controller route style**: direct lowercase (`api/v1/resource-name`), not `[Route("api/v1/[controller]")]` — avoids case-sensitivity bug (ADR-11)
- **JSONB columns**: `.HasColumnType("jsonb")` for `string` properties holding JSON
- **BackgroundService registration**: `builder.Services.AddHostedService<T>()` + consume scoped services via `IServiceScopeFactory`
- **Idempotency pattern**: check log table for matching (RuleId, AppointmentId, same-day SentAt) before firing
- **Versioned amendments pattern**: `PreviousVersionId` + `Version` columns, never silent overwrite (consultation, lab result)
- **Cross-controller roles**: `[AuthorizeRoles("X")]` on controller, defense-in-depth manual claim check
- **File upload pattern**: `IFormFile?` parameter + `[FromForm]`, save to disk with `{id}_v{version}_{guid}{ext}` naming, serve via `UseStaticFiles` with `PhysicalFileProvider`

### File Index (Phase 2 additions — all 9 modules)

```
backend/Hospital_CRM.Api/
├── Controllers/
│   ├── ConsultTemplatesController.cs       # MOD-12
│   ├── InventoryController.cs              # MOD-09
│   ├── LabOrdersController.cs              # MOD-08
│   ├── LedgerController.cs                 # MOD-11
│   ├── MessageTemplatesController.cs       # MOD-13
│   ├── NotificationRulesController.cs      # MOD-13
│   ├── PlatformAdminController.cs          # MOD-14
│   ├── PrecheckController.cs               # MOD-23 (submit)
│   ├── PrecheckReviewController.cs         # MOD-23 (review) — extracted file
│   ├── QueueStatusController.cs            # MOD-25
│   └── WishlistItemsController.cs          # MOD-10
├── Services/
│   ├── NotificationRulesWorker.cs          # MOD-13 background job
│   ├── PrecheckService.cs                  # MOD-23 token gen
│   └── RazorpayReconciliationWorker.cs     # FR-18
backend/Hospital_CRM.Domain/
├── Entities/
│   ├── ConsultTemplate.cs                  # MOD-12
│   ├── ImpersonationLog.cs                 # MOD-14
│   ├── InventoryItem.cs                    # MOD-09
│   ├── LabOrder.cs                         # MOD-08
│   ├── LabResult.cs                        # MOD-08 (versioned)
│   ├── LedgerExpense.cs                    # MOD-11
│   ├── MessageTemplate.cs                  # MOD-13
│   ├── NotificationRule.cs                 # MOD-13
│   ├── NotificationLog.cs (modified)       # MOD-13 added RuleId
│   ├── PrecheckSubmission.cs               # MOD-23
│   ├── PriorityLog.cs                      # MOD-24
│   ├── StockMovement.cs                    # MOD-09 (append-only)
│   ├── TenantFeatureFlag.cs                # MOD-14
│   └── WishlistItem.cs                     # MOD-10
└── Enums/
    ├── AppointmentPriority.cs              # MOD-24
    ├── ExpenseCategory.cs                  # MOD-11
    ├── InventoryEnums.cs                   # MOD-09
    ├── LabEnums.cs                         # MOD-08
    ├── NotificationEnums.cs                # MOD-13
    ├── SubscriptionEnums.cs                # MOD-14
    ├── UserRole.cs (modified)              # MOD-14 added PlatformAdmin
    └── WishlistEnums.cs                    # MOD-10
```

---

## Last Verified Date

2026-08-30

