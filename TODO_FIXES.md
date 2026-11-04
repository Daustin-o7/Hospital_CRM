# Hospital_CRM — Fixes: status

Legend: ✅ done · ⏭️ skipped with reason · ⚠️ open decision

## ✅ Module 1 — Clinic Settings (frontend fields)

- `frontend/src/pages/Settings.tsx`: `ClinicProfile` now carries `noShowHandlingEnabled`,
  `defaultConsultationFee`, `defaultInvoiceStatus`, `pharmacyLicenceNumber20/21`,
  `pharmacyGstNumber`, `tokenFormat`, `tokenStartNumber`, `tokenResetFrequency`.
- `onUpdateProfile` sends all of them (previously 13 of 27 were dropped).
- UI: Billing Defaults, Pharmacy Retail Licensing (Form 20/21 + GST) and Queue Token Settings blocks added.
- `backend/.../ClinicController.cs`: **GET `/clinic/profile` did not return the three pharmacy licence
  fields at all** — added, otherwise the new inputs could never be populated.
- Validation: `[StringLength]` (100/100/50) plus `[RegularExpression]` on the three fields.
  Licence numbers accept any state format (`DL-20-2026-KA-8891`, `KA/B-123/2020-21`) but reject
  characters a licence never contains; GSTIN is validated against the national 15-character format
  (case-insensitive).
- The save handler now surfaces the server's field error (`friendlyError`) instead of "Failed to save profile".
- Tests: `ValidationTests.ClinicProfileRequest_RealLicenceFormats_PassValidation`,
  `ClinicProfileRequest_MalformedLicenceAndGstin_AreRejected` (29/29 in that class).

## ✅ Module 2 — Clinical persistence (draft / amend)

- `frontend/src/pages/Consultations.tsx`: `handleSaveDraft` and `handleConfirmAmendment` now send
  `followUpDate`, `followUpNotes`, `odontogramJson` (finalize already did).
- `frontend/src/schemas/index.ts`: `consultationSoapSchema` gained `advisedInvestigations`,
  `followUpDate` (ISO date), `followUpNotes`, `odontogramJson`.

## ✅ Module 3 — Billing discount rule

- `frontend/src/pages/Billing.tsx`: `discountReason` required when `discountAmount > 0` (`superRefine`).
- `frontend/src/schemas/index.ts`: same conditional rule on `createInvoiceSchema`.
- `backend/.../Program.cs`: demo tenant seeded with Form 20/21 licence numbers and pharmacy GSTIN.
- Phone parsing verified, no change needed: `PharmacyPOS.tsx` strips non-digits and keeps the last 10,
  matching `^[6-9]\d{9}$` (or the `+91` walk-in variant).

## ✅ Module 4 — Vitals audit trail

- `backend/.../VitalsController.cs`: overwriting an appointment's vitals writes a `VITALS_AMENDED`
  `PatientAuditLog` row holding the prior and new clinical values; an identical re-submit writes nothing.
- The `[Range]` bounds are now documented as clinical sanity bounds — the FRD defines no vitals ranges,
  so there is no spec to align to.
- Tests: `Vitals_Overwrite_IsAuditedWithThePriorValues`, `Vitals_UnchangedResubmit_DoesNotWriteAnAmendment`.

## ✅ Module 7 — DB hardening + go-live indexes

- `HospitalCrmDbContext.cs`: `StockMovement` added to the append-only guard (it was documented
  append-only but only `DrugStockMovement` was enforced).
- Migration `20261103174303_EnforceStockMovementAppendOnly`: revokes UPDATE/DELETE on `StockMovements`
  from `app_user` and adds it to the audit DDL-trigger list.
- Migration `20261104151034_AddGoLiveCompositeIndexes` adds all five indexes:
  | Index | Note |
  |---|---|
  | `IX_Patients_TenantId_Phone` | tenant-scoped registration lookup |
  | `IX_Appointments_TenantId_DoctorId_Date_Status` | doctor day view by status |
  | `IX_DrugBatches_DrugId_ExpiryDate_QuantityRemaining` | FEFO dispense |
  | `IX_Invoices_TenantId_PatientId_Status` | patient billing list |
  | `IX_Consultations_TenantId_AppointmentId_CreatedAt` | patient history; `Consultation` has no `PatientId` (it joins through `Appointment`), so the index is keyed on the real columns |
- `dotnet ef migrations has-pending-model-changes` → clean.

## ✅ Cleanup

- `frontend/src/pages/Staff.tsx`: the development demo roster is gone. An empty `/staff` response now
  shows the real empty state instead of five fake doctors, and an API failure no longer injects fakes.

## ⚠️ Open blocker (pre-existing, still red)

`TenantScopedInsertTests.BuildGuard_All_Tenant_Owned_Entities_Must_Implement_ITenantScoped` fails for
`Consultation`, `LabResult`, `PatientConsent`, `Prescription`. The uncommitted migration
`20261102175542_AddClinicalPersistenceAndTenancy` added a **nullable** `TenantId` to those four tables
but the entities were never made `ITenantScoped`, so they get no query filter, no insert auto-fill and
no RLS policy — rows can still be written with `TenantId = NULL`.

Fix plan (needs a decision, it changes nullability of existing clinical rows):
1. `Guid? TenantId` → `Guid TenantId` + `: ITenantScoped` on the four entities.
2. `ConsultationsController` lines 349 and 777 assume a nullable tenant.
3. Migration: backfill `TenantId` from the owning appointment/consultation, `SET NOT NULL`, add the four
   tables to the RLS policy set.

`PasswordFlowRemovedTests` also fails, but only when the test project is built with `--artifacts-path`
(it walks up from the test binary looking for `Program.cs`). Not a product failure.

## Verified, no change needed

- **Nurse roster routes:** `NurseCareController` declares both `handovers` and `nurse-care/handovers`
  (POST lines 153-154, GET 251-252) and `StaffRosterController` exposes `api/v1/staff/roster/{id}/publish`
  and `/lock`. `NurseRoster.tsx` calls both correctly — the original "mismatch" was an analyzer false
  positive on the dual routes and on a template-literal URL.
- `PatientsController` already persists `noticeVersion`, `language`, `captureMethod`; added
  `[StringLength]` caps (50/10/50) so an over-long value is a 400, not a DB error.
- `ConsultTemplatesController` stores `StructureJson` from a `JsonElement.GetRawText()`, so it is valid
  JSON by construction; the column is `text`, so no length failure.

## Apply the two new migrations

```
dotnet ef database update --project backend/Hospital_CRM.Infrastructure --startup-project backend/Hospital_CRM.Api --connection "<owner connection string>"
```
