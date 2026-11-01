# FRD Evidence Table

Maps every Phase 1 requirement (FR-01 to FR-22, `docs/product/FRD_FINAL.md`) and every
Phase 2 module (`FRD-Phase-2-FINAL.md`) to the code that implements it and the automated
test that proves it. This is an evidence index, not a second spec — the FRD remains the
source of truth.

**Baseline:** commit `52fe525` + the A19 fixes on top, backend suite **384 passed, 0 failed**
(`dotnet test tests/Hospital_CRM.Tests`). The frontend has no unit-test runner; UI evidence
is `npm run build` + `npm run lint` plus the Playwright suite in `frontend/e2e/`.

**Status values**
- **Shipped** — implemented to the FRD acceptance criteria and covered by tests.
- **Shipped (coverage gap)** — implemented and verified manually, but no automated test.
- **Gap** — Must-level acceptance criterion not met; tracked below.

## Phase 1 — FR-01 to FR-22

| FR | Requirement | Implementation | Automated evidence | Status |
|----|-------------|----------------|-------------------|--------|
| FR-01 | User login | `AuthController` (`/auth/login`, `/auth/mfa/*`), OpenIddict `AuthorizationController` | `SectionZeroTests`, `Section2AuthTokenTests`, `MfaFlowTests`, `TotpServiceTests`, `PasswordFlowRemovedTests` | Shipped |
| FR-02 | Role-based access | `AuthorizeRolesAttribute`, `PermissionRegistry`; per-endpoint role lists | `StaffRolePolicyTests`, `PlatformAdminAuthorizationTests`, `OwnerRoleTests`, `ClaimsPrincipalExtensionsTests` | Shipped |
| FR-03 | Password reset | `PasswordResetController`, `AuthController.ChangePassword` | `Section2AuthTokenTests` | Shipped |
| FR-04 | Staff invitation & onboarding | `StaffController` (`invite`, `accept-invite`, `invites`) | `Section2AuthTokenTests` (invite token digest), startup guards | Shipped |
| FR-05 | Clinic profile configuration | `ClinicController` (`profile`, `hours`, `holidays`, `special-hours`) | `Section2StaffRosterTests`, `Section5BillingLedgerTests` (profile-driven tax) | Shipped |
| FR-06 | Register new patient | `PatientsController` create + `check-duplicate`; UHID sequence | `Section1HardeningTests` (UHID, family phone, duplicates), `ValidationTests`, `TenantScopedInsertTests` | Shipped |
| FR-07 | Search & view patient profile | `PatientsController.search`, `{id}`; drawer in `Patients.tsx` | `Section1HardeningTests` (min query length) | Shipped |
| FR-08 | Edit patient details + audit | `PatientsController` PATCH, `PatientAuditLog` | — | Shipped (coverage gap) |
| FR-09 | Record patient consent (DPDP) | `PatientConsent` created with registration; withdraw endpoint | `Section1HardeningTests`, `SyncControllerTests` | Shipped |
| FR-10 | Book appointment | `AppointmentsController` create, slot conflict constraint | `Section1HardeningTests` (state machine, check-in), `Section3DoctorConsultationTests` | Shipped |
| FR-11 | View daily schedule | `AppointmentsController` list (`date`, `doctorId`) | `Section1HardeningTests` (`List_FiltersByPatient…`) | Shipped |
| FR-12 | Generate queue token | `AppointmentsController.check-in` (per-doctor counter, tracking token) | `Section1HardeningTests` (`CheckIn_IsIdempotent…`), `Section3DoctorConsultationTests` | Shipped |
| FR-13 | Reschedule / cancel appointment | `AppointmentsController.reschedule`, `PUT`, `AppointmentHistory` | `Section1HardeningTests` (`Reschedule_RejectsOccupiedSlot…`) | Shipped |
| FR-14 | Create consultation note (amend, never overwrite) | `ConsultationsController` draft/finalize/amend, version rows | `ConsultationsControllerTests`, `Section3DoctorConsultationTests`, `Section3ClinicalHardeningTests` | Shipped |
| FR-15 | Write prescription | `ConsultationsController` prescriptions + print/share/PDF | `ConsultationsControllerTests`, `Section3ClinicalHardeningTests`, `Section4PharmacyHardeningTests`, `Section5ServerPdfTests` | Shipped |
| FR-16 | View treatment history timeline | `GET /consultations?patientId=`; patient drawer section | `Section1HardeningTests` (`List_FiltersByPatient…`), `Section3ClinicalHardeningTests` (version history) | Shipped |
| FR-17 | Generate invoice | `InvoicesController` create/finalize/PATCH; GST per line | `Section5BillingLedgerTests`, `Section5BillingAuditFixesTests`, `Section5IndianFyNumberingTests`, `Section5PharmacyBillingLinkTests` | Shipped (see G1) |
| FR-18 | Collect payment (Razorpay) | `PaymentsController`, `InvoicesController` payment/webhook, `PaymentIntegrationsController` | `Section5ReportedPaymentControlsTests`, `Section5PaymentIntegrationsTests`, `PaymentWebhookCodecTests` | Shipped |
| FR-19 | View outstanding dues | `LedgerController.outstanding-dues`, Billing UI | — | Shipped (coverage gap) |
| FR-20 | Send appointment confirmation | `INotificationService`, `WhatsAppNotificationService` / `StubNotificationService`, Hangfire queue | Stub path only (`Section1HardeningTests` fake sender) | Shipped (coverage gap; see G3) |
| FR-21 | Send appointment reminder | `ReminderSchedulerService` (Hangfire recurring job) | Stub path only | Shipped (coverage gap; see G3) |
| FR-22 | Offline-tolerant registration & billing sync | `SyncController` push with idempotency keys | `SyncControllerTests` | Shipped |

## Phase 2 — modules

| Module | Name | Implementation | Automated evidence | Status |
|--------|------|----------------|-------------------|--------|
| MOD-08 | Lab records | `LabOrdersController`, `LabOrders` UI | `PharmacyGateEndpointTests` (module gate), `Section3ClinicalHardeningTests` | Shipped |
| MOD-09 | Inventory (dead / consumable / usable) | `InventoryController`, inventory page | `Section2StaffRosterTests`, `Section3DoctorConsultationTests` | Shipped |
| MOD-10 | Wishlist tracker | `WishlistItemsController`, wishlist page | Module gate tests | Shipped |
| MOD-11 | Finance / accounting ledger (ITR-Ease) | `LedgerController`, `ReportsController` (financial, ITR-4, GSTR-1, payment distribution) | `ReportsControllerTests`, `Section5BillingLedgerTests` (append-only ledger) | Shipped |
| MOD-12 | Speciality EMR templates | `ConsultTemplatesController`, `SpecialtyToolsPanel` | `Section3ClinicalHardeningTests` | Shipped |
| MOD-13 | Notification rules engine | `NotificationRulesController`, `NotificationRulesWorker` | — | Shipped (coverage gap) |
| MOD-14 | Platform admin portal | `PlatformAdminController`, impersonation + IP allowlist | `PlatformAdminAuthorizationTests`, `ImpersonationHardeningTests` | Shipped |
| MOD-23 | Doctor pre-check form | `PrecheckService`, `AppointmentsController` precheck endpoints, intake page | `Section1HardeningTests`, `Section3ClinicalHardeningTests` | Shipped |
| MOD-24 | Emergency priority queue | `AppointmentsController.priority`, `PriorityLog`, Queue UI | `Section1HardeningTests` (structured triage code) | Shipped |
| MOD-25 | Live ticket tracking | `QueueStatusController` (`/queue-status/{token}`), zero-PHI payload | `Section1HardeningTests` (`QueueStatus_ExposesOnlyZeroPhi…`, token rejection) | Shipped |

## Must-level gaps

| # | Gap | Disposition |
|---|-----|-------------|
| G1 | Invoice-level `DiscountAmount` is applied to `Total` only; it is not apportioned across line items, so GSTR-1 reports the pre-discount taxable value and tax. | **Open decision, safe default applied:** every GSTR-1 export that contains such an invoice emits `invoice_level_discount_not_apportioned_to_lines`. Logged in `docs/product/OPEN-QUESTIONS.md` for the CA; no silent re-computation of statutory values. |
| G2 | Mandatory MFA enrolment is config-driven and off in Development (`Mfa:RequireEnrolment`). | Intentional dev switch. Outside Development the default is `true`. Tracked in `docs/technical/GO-LIVE-CHECKLIST.md`. |
| G3 | FR-20/FR-21 and MOD-13 are exercised only against `StubNotificationService`; the WhatsApp provider and retry/backoff path are not covered in CI. | Coverage gap, not a functional gap. Requires a provider sandbox to close; recorded here rather than faked. |

## Other coverage gaps (not Must-level)

- FR-08 patient edit + `PatientAuditLog` has no automated test.
- FR-19 outstanding-dues aggregation has no automated test.
- The Playwright E2E job is a real gate as of A19 (stack brought up via `docker compose`, no
  `continue-on-error`); it cannot be executed in this development environment (no Docker),
  so the YAML change is verified by parse only.
