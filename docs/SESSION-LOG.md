# Session Log — Hospital_CRM

Running record of what was done, verified, and left open. Newest entry last.
Maintained by the agent; updated at the end of every working session.

---

## 2026-10-25 — Section 0 (identity, tenancy, module gateway) + Section 1 re-verification

### Done — Section 0 hardening (all Section 0 findings fixed)

| # | Finding | Fix | Files |
|---|---|---|---|
| P0 | Hand-edited migration had no `Designer.cs`, so EF never discovered it and the model snapshot was stale | Regenerated `20261025105321_AddTenantMembershipTokenFamilyAndAuthAudit` with designer + snapshot; verified `dotnet ef migrations list` shows it at the head | `Infrastructure/Migrations/*` |
| P0 | Model drift (Patient.Uhid, Appointment Triage*/QueueTrackingToken, PatientConsent NoticeVersion/Language/CaptureMethod, DoctorDailyQueueCounters, membership/token/audit tables) existed only in the orphan file | Same migration now carries the whole drift, generated from the model | `Infrastructure/Migrations/20261025105321_*` |
| P1 | `logout` and refresh looked up tokens with a BCrypt scan (silently matched nothing → row stayed alive) | Deterministic SHA-256 digest + `IX_RefreshTokens_TokenHash`, one indexed lookup | `Controllers/AuthController.cs`, `Extensions/TokenHashExtensions.cs` |
| P1 | Refresh dropped the selected clinic scope | `RefreshToken` stores `TenantId`/`ClinicId`/`Role`; refresh re-issues exactly that scope and re-checks membership + subscription | `Domain/Entities/RefreshToken.cs`, `AuthController.Refresh` |
| P1 | Replayed refresh token was only rejected for that one token | Whole `FamilyId` revoked, cookie cleared, `refresh_reuse_detected` audited | `AuthController.Refresh` |
| P1 | Refresh token readable by JS (`sessionStorage`) | Cookie-only; all `setRefreshToken`/`getRefreshToken` removed from the SPA | `frontend/src/services/api.ts`, `context/AuthContext.tsx` |
| P1 | BCrypt cost 11 | 12 (`PasswordExtensions.DefaultWorkFactor`); old hashes still verify | `Extensions/PasswordExtensions.cs` |
| P1 | No explicit membership model | `TenantMembership` (user, tenant, clinic, role, status, default) with unique `(UserId, TenantId, ClinicId)` `NULLS NOT DISTINCT`; migration backfills existing clinic users; invite acceptance creates one | `Domain/Entities/TenantMembership.cs`, `Infrastructure/Data/HospitalCrmDbContext.cs`, `Controllers/StaffController.cs` |
| P1 | Login → clinic picker → single-tenant token | `requiresTenantSelection` + short-lived selection challenge; `select-tenant` also serves clinic switching; sidebar clinic switcher | `AuthController`, `frontend/src/pages/Login.tsx`, `components/DashboardLayout.tsx` |
| P2 | Module gate had no cache, no dependency rules, one generic error | `ModuleGateService` caches 30 s; `ModuleRegistry.Requires` (`pharmacy → inventory`); `module_not_activated` vs `module_disabled` | `Services/ModuleGateService.cs`, `Domain/Constants/ModuleRegistry.cs` |
| P2 | Role checks only; money/clinical actions had no named capability | `Permissions` registry + `[RequirePermission]` on invoice write, payment record, consultation write | `Domain/Constants/PermissionRegistry.cs`, `Authorization/RequirePermissionAttribute.cs` |
| P2 | Doctor could read any patient chart in the tenant | Treating relationship required (creator or appointment); 403 `clinical_access_denied` + `breakGlassRequired`; per-access audited break-glass | `Controllers/PatientsController.cs`, `frontend/src/pages/Patients.tsx` |
| P2 | MFA was fully opt-in, including for admins | `MfaPolicy` mandates ClinicAdmin/Doctor/Receptionist/PlatformAdmin; `mfa_enrolment_required` claim + middleware gate + `/setup-mfa`; disable rejected for those roles | `Domain/Services/MfaPolicy.cs`, `Middlewares/AccountSetupEnforcementMiddleware.cs`, `frontend/src/pages/SetupMfa.tsx` |
| P2 | Auth events were not auditable | `AuthAuditLogs` (append-only grants) for login success/failure/lockout, MFA changes, refresh reuse, tenant switch, role grant, revoke-all | `Domain/Entities/AuthAuditLog.cs`, `Services/AuthAudit.cs`, `scripts/setup-least-privilege-db.sql` |
| P2 | Pipeline order undocumented / wrong in docs | Order documented and wired: Authentication → AccountSetup → Impersonation → Subscription → ModuleGate → Authorization → Idempotency | `Program.cs`, `docs/product/WORKFLOW.md` §0 |
| P2 | Revoke-all left patient drafts and queued invoices on a shared PC | Settings action clears `hospital_crm_draft_*` + offline outbox | `frontend/src/pages/Settings.tsx`, `context/AuthContext.tsx` |
| — | Scope bug found while fixing MFA gate | MFA requirement now follows the **clinic role**, not the account's primary role (Nurse-primary admin membership previously skipped the gate) | `AuthController.SessionClaims/BuildSessionResponseAsync` |

**Verification:** `dotnet build` 0 warnings / 0 errors · `dotnet test` **233 passed** (added `SectionZeroTests`, 6 cases) · `npm run build` OK · `npm run lint` exit 0 (pre-existing warnings only).

### Done — Section 1 re-verification (claims checked against code)

Re-verification of the Section 1 "Hardening & Mapping Complete" report. What holds up:

- Atomic per-doctor, per-day queue counter via `INSERT ... ON CONFLICT DO UPDATE RETURNING` (relational path), clinic-local date via `TimezoneService`.
- Idempotent check-in returns the existing token (`QueueToken.HasValue` guard).
- 128-bit `qtrk_` tracking token; public tracker response carries no patient fields; `queue-status` rate-limit policy registered (30/min).
- Pre-check tokens stored as SHA-256, slot-time expiry, module-gated, DOB-bound on submit.
- Unique slot index `(TenantId, DoctorId, Date, TimeSlot) WHERE Status <> 6` exists in both model and migration.
- Strict appointment transition table; terminal states refuse further moves.
- Versioned consent rows + separate `whatsapp_opt_in`; withdrawal endpoint sets `WithdrawnAt`.
- Structured triage codes + severe-code ER advisory + `PriorityLogs` rows.
- Search audits a `PatientAuditLog` row and enforces ≥2 characters.

Gaps found (see TODO below): UHID collisions, numeric queue-token fallback, `patients.read` not actually enforced, full phone returned by search, exact-duplicate check ignoring DOB, 500 instead of 409 on slot race, Nurse blocked from the status endpoint used by `Queue.tsx`, reminder job ignoring WhatsApp consent, orphan duplicate migration file.

### TODO (open)

> All Section 1 rows below were fixed in this session — see "Section 1 fixes applied" further down.

| Pri | Item | Status |
|---|---|---|
| P0 | Delete redundant, undiscovered `20261025160000_Section1ReceptionAndIntakeHardening.cs` (no designer; duplicates the regenerated migration; contains `DropColumn` statements that would fire if someone added a designer) | TODO |
| P1 | UHID: `RandomNumberGenerator.GetInt32(1000, 9999)` collides (~9000 values/clinic/month) → unique index throws 500 | TODO |
| P1 | Public tracker still accepts bare numeric tokens → cross-tenant enumeration of queue numbers | TODO |
| P1 | `patients.read` permission claimed but absent; add to registry + apply to patient reads | TODO |
| P1 | Search returns full `phone` despite "minimized identifiers" comment | TODO |
| P1 | Exact-duplicate check ignores DOB → same-name family member silently merged | TODO |
| P1 | Cancelled-slot race returns 500 (unique violation) instead of 409 in Book/Reschedule | TODO |
| P1 | `PUT /appointments/{id}` excludes Nurse, but `Queue.tsx` shows nursing buttons to nurses → 403 | TODO |
| P1 | Reminder job sends without checking `whatsapp_opt_in` | TODO |
| P2 | Receptionist emergency triage still accepts 10 characters of free text instead of a structured code | TODO |
| P2 | Consent withdrawal is not audited | TODO |
| P2 | Guardian name/relationship captured but not required for minors, and the registration form has no inputs for them | TODO |
| P2 | `PriorityLog` records "urgent" as "emergency", losing the distinction | TODO |
| P2 | Docs: Section 1 triage code `other_urgent` ≠ code `other_clinical_urgency`; nurse role missing from update table; "218 tests" figure stale | TODO |

### Notes / limitations

- No Postgres on this host: migrations are generated and reviewed, **not executed**. RLS policies and backfill SQL only run on a real DB.
- EF InMemory ignores RLS and unique indexes; unique-violation paths are unit-tested only through the app-level pre-check.
- Existing refresh tokens are invalid after the SHA-256 change — every user signs in again once.

---

## 2026-10-25 — Section 1 fixes applied

| Finding | Fix | Files |
|---|---|---|
| UHID collisions | Sequential per tenant+month (`NextUhidAsync`), unique-violation retry takes the next number | `Controllers/PatientsController.cs` |
| Numeric queue token fallback | Public tracker accepts only `qtrk_` tokens | `Controllers/QueueStatusController.cs` |
| `patients.read` missing | Added to `Permissions`, applied to search/get-all/get-by-id | `Constants/PermissionRegistry.cs`, `PatientsController` |
| Full phone in search results | Response returns `phoneLast4` only; SPA type + rendering updated | `PatientsController`, `frontend/src/pages/Patients.tsx` |
| Duplicate check ignored DOB | Same person now = phone + name + DOB; shared phone still prompts | `PatientsController.Register` |
| Slot race → 500 | `IsUniqueViolation()` (SQLSTATE 23505) → 409 in book and reschedule | `Extensions/DbUpdateExceptionExtensions.cs`, `AppointmentsController` |
| Nurse 403 on status update | Nurse allowed, restricted to `InNursing`/`InConsultation` | `AppointmentsController.Update` |
| Reminders ignored consent | Job filters on live `whatsapp_opt_in` | `Services/ReminderSchedulerService.cs` |
| Free-text emergency triage | Receptionist must send a structured `TriageReasonCode` | `AppointmentsController.UpdatePriority` |
| Consent withdrawal not audited | `PatientAuditLog` row `CONSENT_WITHDRAWN` | `PatientsController.WithdrawConsent` |
| Orphan Section 1 migration | Deleted (no designer, duplicated the regenerated migration) | `Infrastructure/Migrations` |

Verification: `dotnet build` 0/0 · `dotnet test` **246 passed** · `npm run build` OK · `npm run lint` exit 0.

Remaining Section 1 P2 (not fixed, low risk): guardian name/relationship not enforced for minors and not on the form; `PriorityLog` folds "urgent" into "emergency"; WORKFLOW §1 still says `other_urgent` where the code uses `other_clinical_urgency`.

---

## 2026-10-25 — Section 2 re-verification (claims checked against code)

Confirmed true:

- Core vitals live in `VitalsController` with no module gate (`/api/v1/appointments/{id}/vitals`); saving for a `CheckedIn` appointment moves it to `InNursing`; BMI computed server-side.
- `PatientVital`, `ShiftTemplate`, `StaffRoster`, `ShiftChangeRequest`, `AuthorityProxy`, `StaffTeam(+Member)`, `StaffAnnouncement` all implement `ITenantScoped` and therefore get the global tenant query filter; all are registered in `HospitalCrmDbContext` with tenant/clinic indexes.
- Roster lifecycle exists server-side (`Draft` → `Published` → `Locked`, lock freezes `IsLocked` on the roster's shifts); publish/lock are audit-logged via `_logger` and timestamps.
- `StationOrWard` on `NurseShift`; `/shifts` accepts it.
- Double assignment blocked at accept time (409 `double_assignment_conflict_detected`).
- Direct swap and open cover exist; application is wrapped in a DB transaction with both assignments updated together and `ApprovedByUserId` / `ApprovedOnBehalfOfUserId` recorded.
- Leave approval releases conflicting assigned shifts to `Open`, appends the coverage note, sets `CoverageGapAlertCreated`, returns `hasRosterConflict` — verified by `Section2StaffRosterTests`.
- `CertificateSeen` is a boolean on `LeaveRequest`; no document upload anywhere.
- Announcements are the only team messaging (no chat/message table or endpoint).
- Structured handover (`WhatHappened` / `WhatIsPending` / `CriticalAlerts`) implemented in `NurseCareController`.
- `Section2StaffRosterTests` (6 cases) exist and pass; total suite 246 green.

Gaps found (claims that do not hold):

| Pri | Finding |
|---|---|
| P0 | Roster controller route is `api/v1/roster`, but WORKFLOW §2 and every SPA call use `/api/v1/staff/roster/...`. Every roster call in `NurseRoster.tsx` is wrapped in `.catch(() => [])`, so the whole module renders empty instead of erroring — silently dead UI. |
| P0 | Documented endpoints do not exist: `GET /staff/roster/swaps`, `POST /staff/roster/open-shifts/{id}/claim`, `POST /staff/roster/leave-impact` (implemented as GET with query params), `GET/POST /staff/roster/proxies` (implemented as `authority-proxies`). |
| P0 | "Read-only when deactivated" is false: `[RequireModule]` is class-level, so a deactivated module blocks GETs too. |
| P1 | `CreateAuthorityProxy` accepts an arbitrary `DelegatorUserId` and free-text `Permissions` from any nurse → a nurse can mint themselves approval rights. No revoke endpoint despite `IsRevoked`. |
| P1 | Approval does not re-validate double assignment at approval time (only at accept), contradicting the claim; a shift assigned between accept and approve is silently doubled. |
| P1 | Self-approval guard only covers the caller's own nurse profile; approving on behalf of a delegator who is a party to the request is allowed. Same hole in `ReviewLeave`. |
| P1 | `CheckLeaveImpact` uses a hard-coded coverage minimum `2` instead of `ShiftTemplate.RequiredCoverage`. |
| P1 | Rest-gap rule is not implemented at all (claimed as a warning). |
| P1 | `PublishRoster` does not adopt shifts in its date range, so shifts created via `/shifts` are never locked by `LockRoster` and swaps on them never hit `IsLocked`. |
| P2 | `VitalsController` has no capability check and writes no audit row; it accepts vitals on `Completed`/`Cancelled`/`NoShow` appointments (mutating a closed encounter). |
| P2 | Lifecycle bar in `NurseRoster.tsx` only sets local state (no API call) — Publish/Lock are cosmetic. |
| P2 | `ListOpenShifts` does not return `requesterNurseName`, which the UI renders as "Posted by undefined". |
| P2 | Migration for Section 2 was originally hand-written with no designer; it has since been regenerated as `20261025113504_Section2TriageVitalsAndStaffRoster` (+ designer + snapshot). Re-verified; see "Section 2 fixes applied". |

### Section 2 TODO

| Pri | Item | Status |
|---|---|---|
| P0 | Align roster route with docs/SPA (`api/v1/staff/roster`) | DONE |
| P0 | Add missing endpoints: `GET swaps`, `POST open-shifts/{id}/claim`, `POST leave-impact`, `proxies` path | DONE |
| P0 | Move module gate to write actions only so deactivated ⇒ read-only | DONE |
| P1 | Authority proxy: admin-only creation, permission whitelist, staff-scope validation, revoke endpoint | DONE |
| P1 | Re-validate double assignment at approval; self-approval guard covers delegator side (swap + leave) | DONE |
| P1 | Coverage minimum from `ShiftTemplate.RequiredCoverage` | DONE |
| P1 | Rest-gap warning from shift templates | DONE (fixed 11 h, warning only) |
| P1 | Publish roster adopts in-range unrostered shifts | DONE |
| P2 | Vitals: `vitals.write` permission, audit row, terminal-state guard | DONE |
| P2 | Wire the lifecycle bar to publish/lock APIs | DONE |
| P2 | `requesterNurseName` on the open-shift board | DONE (phantom field removed — an open shift has no requester) |

---

## 2026-10-25 — Section 2 fixes applied

| Finding | Fix | Files |
|---|---|---|
| Route mismatch — whole module silently dead | `[Route("api/v1/staff/roster")]`, matching WORKFLOW §2 and every SPA call | `Controllers/StaffRosterController.cs` |
| Missing documented endpoints | Added `GET swaps` (`ListShiftChanges`) and `POST open-shifts/{id}/claim` (`ClaimOpenShift`, creates an `Accepted` OpenCover request so approval still applies); `leave-impact` converted to `POST` with `LeaveImpactRequest(NurseProfileId, StartDate, EndDate)` returning `conflictsCount`; `authority-proxies` → `proxies` | same |
| Class-level `[RequireModule]` blocked reads | Gate moved onto each write action only; the class attribute is gone, so a deactivated tenant keeps read access | same |
| Nurse could mint own approval rights | `CreateAuthorityProxy` is ClinicAdmin-only (explicit check *and* attribute), both parties must be clinic `ClinicAdmin`/`Nurse`, `ValidUntil` must be in the future, permissions whitelisted to `roster.approve`/`leave.approve`, and a `POST proxies/{id}/revoke` endpoint now exists | same |
| Multi-shift double assignment at approval | `ApproveWouldDoubleAssignAsync` re-checks at approve time and returns 409 `double_assignment_conflict_detected`; the request stays `Accepted` | same |
| Approval on behalf of a swap participant | `IsSwapParty` blocks both the acting approver *and* the delegator they act for | same, `Controllers/NurseController.cs` |
| Hard-coded coverage minimum | `CheckLeaveImpact` reads `ShiftTemplate.RequiredCoverage` (falls back to 2 for template-less shifts) | same |
| Rest-gap rule absent | `RestGapWarningsAsync` + `MinimumRestHours = 11`: warning only, template-derived times, returned as `restGapWarnings` from approve | same |
| Publish never adopted `/shifts` rows, so Lock froze nothing | `PublishRoster` assigns in-range `RosterId == null` shifts to the roster | same |
| Vitals had no capability check, audit row, or closed-encounter guard | `[RequirePermission(Permissions.VitalsWrite)]` on POST, `PatientsRead` on both GETs, 409 `appointment_closed` for `Completed`/`Cancelled`/`NoShow`, `PatientAuditLog` row `VITALS_RECORDED` | `Controllers/VitalsController.cs`, `Constants/PermissionRegistry.cs` |
| Lifecycle bar cosmetic | `handleSetLifecycle` calls `POST /staff/roster`, `/{id}/publish`, `/{id}/lock` and reloads `GET /staff/roster` | `frontend/src/pages/NurseRoster.tsx` |
| "Posted by undefined" | Dropped — open shifts carry no requester; swaps list does return `requesterNurseName` | same |

Verification: `dotnet build` 0 warnings/0 errors · `dotnet test` **255 passed, 0 failed** (6 new `Section2StaffRosterTests` cases: write-vs-read gating + route, proxy admin/whitelist, approval double-assign re-validation, on-behalf-of participant ban, template coverage, vitals closed+audit, `VitalsWrite` role theory) · `npm run build` clean · `npm run lint` exit 0 · `dotnet ef migrations has-pending-model-changes` → "No changes have been made to the model since the last migration."

### Section 2 gaps left open (honest list)

| Pri | Item |
|---|---|
| P2 | `restGapWarnings` are only produced on approval, not on accept or on manual shift assignment. |
| P2 | Rest floor is a code constant; consecutive-night caps and tenant-configurable floors are not implemented (WORKFLOW §2.2 now says so). |
| P2 | `ClaimOpenShift` does not notify the head nurse; the claim only appears in `GET swaps`. |
| P2 | No UI for authority proxies or `POST proxies/{id}/revoke` — API only (`NurseRoster.tsx` has no proxy tab). |
| P2 | `LeaveImpactRequest` takes a `NurseProfileId` from the body with no ownership check; a nurse can inspect another nurse's roster impact (read-only, same clinic). |

### Migration reconciliation (read before touching `Migrations/`)

- `20261025113504_Section2TriageVitalsAndStaffRoster` is the real Section 2 schema and was regenerated with its designer + snapshot.
- `20261025114551_AddMissingClinicalColumns` exists because `Patient.Allergies/BloodGroup/ChronicConditions/DateOfBirth`, `Appointment.Notes`, `TenantMembership.Qualifications/RegistrationNumber`, `PrescriptionItem.BrandName` and the Section 3 lab columns were already in the model before any migration captured them. Section 3's own `20261025114917_Section3DoctorConsultationAndStructuredRx` therefore came out **empty** — the columns it meant to add are inside `AddMissingClinicalColumns`.
- Do not delete `AddMissingClinicalColumns` and do not regenerate Section 3 until you confirm both share a deploy order; deleting it now would drop those columns from a fresh database.
- `dotnet ef migrations remove` fails on this host (`The ConnectionString property has not been initialized`), so any migration cleanup is manual file deletion.

---

## Final verification (last run of this session)

| Check | Result |
|---|---|
| `dotnet build backend/Hospital_CRM.Api` | 0 warnings, 0 errors |
| `dotnet test` | **263 passed, 0 failed** (255 at the time Section 2 finished; the concurrent Section 3 work added 8) |
| `npm run build` | built in 750 ms (chunk-size warning pre-existing) |
| `npm run lint` | exit 0 (warnings only, all pre-existing) |
| `dotnet ef migrations has-pending-model-changes` | no pending changes |

Nothing is committed or pushed — all work sits uncommitted on `main`, as agreed.

The tree is being edited concurrently (Section 3: consultations / lab / structured Rx). It briefly broke the test project's compilation twice during this session; both times it recovered without any change from me. Do not regenerate or delete `Section3DoctorConsultationAndStructuredRx` or `AddMissingClinicalColumns` — see the migration note above.


---

## 2026-10-25 — Section 3 re-verification (claims checked against code)

Confirmed true:

- `ConsultationsController` has claim / park / recall, draft autosave, single-transaction finalize, amend, and anonymous verify endpoints. `AppointmentStatus.Parked` and `ConsultationStatus.{Draft,Finalized,Amended}` exist.
- Finalize runs inside one relational transaction: it writes the consultation, `Prescription` + `PrescriptionItem` lines, `LabOrder` rows, flips the appointment to `Completed`, and optionally creates a follow-up appointment.
- Pediatric weight guard, NDPS block, allergy substring warnings and duplicate-generic warnings are real, and the two error codes match the frontend copy.
- Amendments create a new row with `Version = existing.Version + 1`, `Status = Amended`, `PreviousVersionId` set, reason stored; the original row is untouched.
- `LabOrder` / `LabResult` are versioned; results keep `PreviousVersionId`; doctor review stamps `DoctorReviewedAt` / `DoctorReviewedByUserId`.
- Context panel writes a `CONSULTATION_READ` row to `PatientAuditLogs`.
- 263 tests pass, the model has no pending changes, and the Section 3 migration is applied.

Gaps found:

| Pri | Finding |
|---|---|
| P0 | Context panel is **404 in the SPA**: backend route is `patients/{id}/context-panel`, but `Consultations.tsx` and WORKFLOW §3.2/§3.8 call `patients/{id}/clinical-context`. `Promise.allSettled` swallows it, so the allergy / vitals / last-Rx panel is always empty. |
| P0 | Draft autosave never persists prescriptions: the SPA posts `prescriptions`, the DTO is `prescriptionItems`, so the server draft stores zero medicine lines. A page reload or another device loses the whole e-Rx. |
| P0 | Finalize is not idempotent and does not require amending: with no open draft it creates a **new** `Version = 1` finalized row. Double-click or a second doctor produces two v1 records, and there is no unique index on `(AppointmentId, Version)`. |
| P0 | Amend erases the prescription: when `PrescriptionItems` is null the new version is created with **no** `Prescription` at all, so the visit's active e-Rx disappears from the newest version. |
| P0 | Claim hijacks the appointment (`appointment.DoctorId = callerId`), so any doctor can take another doctor's patient and then finalize it as their own. |
| P1 | Claim is read-then-write; `[ConcurrencyCheck] UpdatedAt` turns a lost race into a 500 `DbUpdateConcurrencyException` instead of the documented 409. |
| P1 | NDPS guard trusts the client-supplied `ScheduleClass` string; ordering an NDPS `Drug` by `DrugId` with the field omitted passes the check. |
| P1 | Signature is not verifiable: `SignedAt` and the timestamp inside the hash are two separate `UtcNow` calls, so the hash can never be recomputed; `VerifyPrescription` returns it without validating anything. |
| P1 | Amendments reuse the original `VerificationQrCode`, and verify does `FirstOrDefault` — a chemist can land on the superseded version. |
| P1 | Finalize response returns `warnings`; `FinalizeSuccessModal` reads `safetyWarnings` — allergy/duplicate warnings are never displayed. |
| P1 | `SaveDraft`/`Finalize`/`Amend`/`Claim`/`Park`/`Recall` write **nothing** to `PatientAuditLogs`, contradicting "every read/write audited". Only the context panel is audited. |
| P1 | Finalize accepts any appointment status (a `Booked`, `Cancelled` or already-`Completed` visit can be sealed); `SaveDraft` happily opens a draft on a completed appointment. |
| P1 | Pediatric weight may come from an old visit: the vitals query is `AppointmentId == X || PatientId == Y` ordered by `RecordedAt`, so last year's weight satisfies "today's vitals". |
| P1 | Lab results are invisible: the worklist returns only `latestResultVersion`; there is no endpoint or UI that returns the result text/file, so a doctor cannot actually perform the review the workflow requires. `LabOrderStatus.Completed` is unreachable. |
| P1 | SPA fabricates clinical data: `bloodGroup: p.bloodGroup || 'O+'` (no such field on `Patient`) and `allergies: p.allergies || 'NKDA'` display a made-up blood group and a false "no known allergies". |
| P2 | Lab orders are not billable: finalize inserts `LabOrder` rows but no `Invoice`/`InvoiceLineItem`; there is no price field on `LabOrder` either. WORKFLOW §3 diagram says "billable line". |
| P2 | No PDF and no QR image anywhere; the verification code is only returned as JSON. WORKFLOW §3.6 says "printed prescription PDFs embed a QR". |
| P2 | No Favorites, no Protocols, and no server-side "copy previous Rx" — WORKFLOW §3 diagram advertises all three. |
| P2 | `ConsultTemplate` has no version column, so `Consultation.TemplateVersion` is whatever the client sends and can never be checked. |
| P2 | Verify route is `/api/v1/consultations/verify-rx/{code}`, not the documented `/api/v1/prescriptions/verify/{code}`. |
| P2 | Pediatric age uses `Year - Year`, ignoring month/day, so a child who turns 12 next month is treated as 12 today. |
| P2 | Receptionist can read clinical notes (`GET /consultations`, `/consultations/{id}`, `/prescriptions`). |

### Section 3 TODO

| Pri | Item | Status |
|---|---|---|
| P0 | Context panel route → `patients/{id}/clinical-context` | DONE |
| P0 | Draft autosave sends `prescriptionItems` | DONE |
| P0 | Block double finalize; require amend once finalized | DONE |
| P0 | Amend must carry the prescription forward (never create an Rx-less version) | DONE |
| P0 | Claim must not reassign another doctor's appointment | DONE |
| P1 | Claim race → 409 instead of 500 | DONE |
| P1 | Resolve NDPS from `Drug.ScheduleClass`, store server truth | DONE |
| P1 | Reproducible signature (single timestamped, second-precision) + `signatureValid` in verify | DONE |
| P1 | Verify returns the latest version for a reused code | DONE |
| P1 | Finalize modal reads `warnings` | DONE |
| P1 | Audit rows for claim / park / recall / draft-create / finalize / amend | DONE |
| P1 | Finalize rejects terminal appointment states; draft rejects closed visits | DONE |
| P1 | Pediatric weight from this visit's (or today's) vitals only | DONE |
| P1 | `GET lab-orders/{id}` with the latest result; review requires a result | DONE |
| P1 | Remove fabricated `O+` / `NKDA` defaults in the SPA | DONE |
| P2 | Fix WORKFLOW §3 claims: billable lab line, PDF/QR, favorites/protocols, chronic conditions, template versioning, verify path | DONE |

### Section 3 — fixes applied

| Finding | Fix | Where |
|---|---|---|
| Context panel 404 in the SPA | Route renamed to `patients/{id}/clinical-context` (matches the SPA and the docs) | `ConsultationsController.GetPatientContextPanel` |
| Draft autosave dropped every medicine line | SPA now posts `prescriptionItems`; the draft sync path rebuilt to use the shared item mapper | `frontend/src/pages/Consultations.tsx:445`, `ConsultationsController.SaveDraft` |
| Double finalize created a second v1 record | `409 consultation_already_finalized` when a signed row exists; `SaveDraft`, `Finalize` and legacy `CreateConsultation` all honour the one-record rule; unique index `(AppointmentId, Version)` catches the race; `DbUpdateException.IsUniqueViolation()` → `409` | `ConsultationsController`, `HospitalCrmDbContext`, `DbUpdateExceptionExtensions` |
| Amend erased the prescription | `PrescriptionItems == null` now clones every prior line; a supplied list keeps dispensed lines; the new version always has a `Prescription` | `ConsultationsController.AmendConsultation` |
| Claim hijacked another doctor's visit | `DoctorId` is never reassigned; a different doctor gets `409 appointment_assigned_to_another_doctor`; admin exempt | `ConsultationsController.ClaimAppointment` |
| Claim race surfaced as 500 | `DbUpdateConcurrencyException` → `409 appointment_already_claimed_or_processed` | same |
| Park / recall had no ownership check | `CanActOnVisit` (treating doctor or clinic admin), audits `APPOINTMENT_PARKED` / `APPOINTMENT_RECALLED` | `ParkAppointment`, `RecallAppointment` |
| NDPS trusted the client string | Schedule class resolved from `Drugs` for linked lines (`LoadDrugSchedulesAsync`), stored server truth via `BuildItem` | `FinalizeConsultation`, `BuildItem` |
| Signature could never be verified | One `signedAt` truncated to whole seconds, hashed as `doctorId\|appointmentId\|consultationId\|diagnosis\|unixSeconds`; `VerifyPrescription` recomputes and returns `signatureValid` | `SignatureHash`, `SecondPrecision`, `VerifyPrescription` |
| Verify could return the superseded version | Latest signed version per code, plus `version` and `amended` in the payload | `VerifyPrescription` |
| Warnings never displayed | `FinalizeSuccessModal` reads `warnings` (keeps `safetyWarnings` as a fallback) | `FinalizeSuccessModal.tsx` |
| Clinical writes were not audited | `Audit()` helper appends `APPOINTMENT_CLAIMED/PARKED/RECALLED`, `CONSULTATION_DRAFT_CREATED`, `CONSULTATION_FINALIZED`, `CONSULTATION_AMENDED` to `PatientAuditLogs` | `ConsultationsController` |
| Finalize accepted any appointment status | Rejects anything outside `CheckedIn / InNursing / InConsultation` (`409 appointment_not_in_consultation`); draft rejects `Cancelled`/`NoShow`/`Completed` (`409 appointment_closed`) | `FinalizeConsultation`, `SaveDraft` |
| Pediatric weight came from an old visit | This visit's vitals first, then today's for the patient; older visits never satisfy the check | `FinalizeConsultation` |
| Lab results unreadable | New `GET lab-orders/{id}` returning the newest `LabResult`; review refuses with `409 no_result_to_review` | `LabOrdersController` |
| SPA invented `O+` / `NKDA` | Replaced with `Not recorded` | `Consultations.tsx:259-260` |
| Prescription lines editable after signing | `AddPrescription` rejects non-draft consultations (`409 consultation_already_finalized`) | `ConsultationsController.AddPrescription` |
| Amendment reason was optional in practice | Minimum 5 characters, drafts refused (`400 cannot_amend_draft`); a concurrent amendment loses on the unique index and returns `409 consultation_amended_concurrently` | `AmendConsultation` |
| WORKFLOW §3 overstated the build | §3 diagram, §3.1–§3.8 rewritten against the code: no billable lab line, no PDF/QR image, no favourites/protocols, no chronic-condition list, no template versioning, lab detail endpoint added, verify path corrected | `docs/product/WORKFLOW.md` |
| Migration for the one-record rule | `20261025161047_AddConsultationVersionUniqueIndex` created **and applied**; `IX_Consultations_AppointmentId_Version` confirmed via `psql` | `backend/Hospital_CRM.Infrastructure/Migrations/` |
| No regression coverage for the above | 9 new tests in `Section3ClinicalHardeningTests` (context route, double finalize, closed visit, draft-after-finalize, amend keeps Rx, claim theft, catalogue NDPS, verify signature + latest version, lab review without result) | `tests/Hospital_CRM.Tests/Section3ClinicalHardeningTests.cs` |

### Section 3 — remaining gaps (P2, not fixed)

| Pri | Gap | Why it was left |
|---|---|---|
| P2 | Lab orders raise no invoice line; `LabOrder` has no price field | Needs a billing decision (price source, when to bill) that the FRD does not settle |
| P2 | No prescription PDF and no QR **image**; the code is text in the finalize modal | No PDF/QR dependency installed; no print pipeline exists |
| P2 | No drug favourites, no protocol library, no server-side copy-previous | Copy-previous works client-side from the context panel; the other two are unbuilt features, not broken ones |
| P2 | `ConsultTemplate` has no version column, so `TemplateVersion` is client-reported | Would need a template-versioning migration and a bump-on-edit rule |
| P2 | Pediatric age is `Year - Year` | Month/day precision needs a DOB-based helper used by every age comparison |
| P2 | Receptionist can still read `GET /consultations`, `/consultations/{id}`, `/prescriptions` | Tightening it touches the reception/queue screens; needs a product call |
| P2 | `LabOrderStatus.Completed` is never set | `ReviewedByDoctor` is the de-facto terminal state; the enum value is dead |
| P2 | No public verification page; the SPA has no lab-test picker (`orderedLabTests: []`) | Both are UI work on top of working endpoints |

### Section 3 — final verification

| Check | Result |
|---|---|
| `dotnet build backend/Hospital_CRM.Api` | 0 warnings, 0 errors |
| `dotnet test` | **272 passed, 0 failed** (263 before this pass; +9 hardening tests) |
| `dotnet ef migrations has-pending-model-changes` | no pending changes |
| `dotnet ef database update` | `20261025161047_AddConsultationVersionUniqueIndex` applied |
| `IX_Consultations_AppointmentId_Version` | exists, unique, verified via `psql` |
| `npm run build` | succeeded (pre-existing chunk-size warning only) |
| `npm run lint` | exit 0 (warnings only, all pre-existing `set-state-in-effect` / fast-refresh notices) |

Section 3 is now verified end-to-end against the code, with the P2 items above still open and documented rather than silently claimed.

---

## 2026-10-26 — Section 4 re-verification (Pharmacy 4A + External Rx 4B)

Confirmed true:

- `CdciMedicineCatalogService` really parses `GenericMaster.txt` (10,305 generics) and `BrandMaster.txt` (93,911 brands) from the CDCI package; results carry `dataSource = "CDCI (Open Source)"`, `isUnverified = true`.
- `POST /api/v1/medicines/curate-from-source` promotes a CDCI hit into `Drugs` as verified; `MedicineSearchMissLogs` is written when a search returns nothing.
- `DrugStockMovement` ledger exists, is append-only in the DbContext, and `CK_DrugBatch_QuantityRemaining_NonNegative` is in the migration.
- `POST /api/v1/pharmacy/stock-in`, `batches/{id}/recall`, `batches/{id}/adjust` exist; Form 20/21 gate and the NDPS dispense block exist in both POS checkout and Rx dispense.
- MRP-inclusive reverse GST is implemented (`taxable = gross / (1 + rate)`, `gst = gross - taxable`).
- Schedule H1/X dispensing writes an immutable `ControlledSubstanceRegister` row; CSV export exists.
- `GET /api/v1/prescriptions/{id}/print` logs to `PrescriptionPrintLogs` and stamps `DUPLICATE COPY` on reprint.
- `frontend/src/pages/VerifyRx.tsx` is routed at `/rx-verify/:code` and `/verify-rx/:code`.
- Migration `20261025212901_Section4PharmacyLedgerAndExternalRx` exists and is applied.

Gaps found:

| Pri | Finding |
|---|---|
| P0 | Verify reports the **active** prescription as superseded after any amendment: the latest row has `Status = Amended`, and `isSuperseded` is true when `consultation.Status == Amended`. Every amended e-Rx tells the chemist "DO NOT dispense". |
| P0 | Verify mixes versions: it always loads the latest row, so `?v=1` returns v2's medicines/hash while labelling them `currentVersion = 1`; an unknown `?v=99` is accepted as real. |
| P0 | Rx dispense never matches real prescription lines: it matches `PrescriptionItem.MedicineText` ("Paracetamol 650mg") against `Drug.Name`/`GenericName`, so almost every line falls through to a `DispenseItem` with `DrugBatchId = Guid.Empty` - a guaranteed FK violation (500), and no stock/`IsDispensed`/H1 register update. |
| P0 | The NDPS dispense block reads only the (usually empty) matched-drug list, so it is bypassed by the same matching bug. |
| P0 | Prescribing a CDCI catalogue entry crashes finalize: the SPA sends a deterministic GUID for an open-source hit, `PrescriptionItem.DrugId` has a real FK, and no such `Drug` row exists. |
| P0 | Share links are not signed in any verifiable way: the HMAC key is a hardcoded literal, and `VerifyPrescription` ignores `exp`/`sig`, so links never expire and the signature is decorative. |
| P0 | `PharmacyBatchController` and `PharmacyCatalogController` have **no** `[RequireModule(Pharmacy)]`; an unentitled clinic can stock-in, adjust, recall and edit the drug catalogue. |
| P0 | `GET /pharmacy/substitutes/{drugId}` matches generics by substring, so "Paracetamol" suggests "Paracetamol + Codeine" - a different medicine presented as a substitution option. |
| P1 | `stock-in` accepts `SupplierLicenceNumber` and silently drops it; there is no invoice-date column either, contradicting the claim that both are recorded. |
| P1 | `StockIn` dereferences `req.BatchNumber` without a null guard (500 on a malformed direct call) and does not reject an expiry in the past. |
| P1 | Batch recall sets `IsRecalled` but leaves `QuantityRemaining` untouched while writing an "Out" ledger row - the ledger and the running stock disagree. |
| P1 | Rx dispense takes `PrescriberName`/`PrescriberRegNo` from the request body, so the statutory H1 register can be filled with any name; it should come from the signed consultation. |
| P1 | Rx dispense has no cap on `DispensedQuantity` vs `TotalQuantity`, and `DispenseRecords.IdempotencyKey` has no unique index, so concurrent repeats both commit. |
| P1 | POS trusts client `GstRate` (a 0% payload zeroes the tax) and client `UnitPrice` (can go down to 50% of purchase rate), contradicting "the patient pays the exact printed MRP". |
| P1 | POS/Refund licence gate is `if (clinic != null && ...)`: no clinic row means no gate, and it reads an arbitrary clinic in a multi-clinic tenant. |
| P1 | POS refund re-checks `Status == Refunded` outside the transaction; two concurrent returns both refund the full invoice. |
| P1 | The new ledger tables are not in `scripts/setup-least-privilege-db.sql`, and their FKs cascade, so `app_user` can UPDATE/DELETE them despite the append-only rule. |
| P2 | "Server-side PDF" is a JSON DTO; no PDF/HTML template exists. |
| P2 | No pharmacy UI for stock-in, recall, adjust, movements, curate-from-source, miss logs or dispense; the amber badge only appears in the doctor's e-Rx editor. |
| P2 | CDCI parser does a linear scan of 94k brands per keystroke, blocks the first request on a 13 MB read, has a hardcoded `E:\...` probe path and no cancellation checks. |
| P2 | Rx dispense records a `DispenseRecord` and `totalAmount` but raises no invoice/payment, so counter dispensing is unbilled. |
| P2 | `Drugs.DataSource` defaults to `""` for pre-existing rows, so the search response shows a blank source. |
| P2 | `VerifyRx.tsx` prints "VERIFIED" when a doctor registration number is missing - it should say it is not recorded. |
| P2 | Section 4 report claims 12 new tests; `Section4PharmacyHardeningTests.cs` contains 9 `[Fact]`s. |

### Section 4 TODO

| Pri | Item | Status |
|---|---|---|
| P0 | Verify: superseded only when the requested version is older; never because the latest row is `Amended` | DONE |
| P0 | Verify: return the requested version's payload; 404 on an unknown version | DONE |
| P0 | Rx dispense: resolve items by `DrugId` then exact brand/medicine text, then generic+strength+form; no `Guid.Empty` fallback | DONE |
| P0 | Rx dispense: NDPS block from the item's stored schedule, not only matched drugs | DONE |
| P0 | Finalize: drop a `DrugId` that is not in the catalogue (CDCI hits) | DONE |
| P0 | Share link: key from configuration; validate `exp` + `sig` on verify; reject expired | DONE |
| P0 | Module gate on `PharmacyBatchController` and `PharmacyCatalogController` | DONE |
| P0 | Substitutes: exact generic + strength + form, in-stock, not recalled | DONE |
| P1 | Stock-in: record supplier licence + invoice date; validate batch number and expiry | DONE |
| P1 | Recall: zero the batch quantity so ledger and stock agree | DONE |
| P1 | Dispense: prescriber identity from the signed consultation; cap dispensed quantity; unique idempotency key | DONE |
| P1 | POS: use catalogue `GstRate` and batch `Mrp` server-side | DONE |
| P1 | POS + dispense: fail-closed licence gate | DONE |
| P1 | Refund: re-check `Refunded` inside the transaction | DONE |
| P1 | DB role: REVOKE UPDATE/DELETE on the new ledger tables; FKs to `Restrict` | DONE |
| P2 | Fix report/WORKFLOW claims: PDF, pharmacy UI, test count, gap notes | DONE (docs corrected; PDF and pharmacy UI documented as not built) |

### Fixes applied

| # | File | Change |
|---|---|---|
| 1 | `ConsultationsController.cs` | `IConfiguration` injected (optional 3rd ctor arg); verify loads all signed versions, selects the requested one, `isSuperseded` only when older, 404 `prescription_version_not_found`. |
| 2 | `ConsultationsController.cs` | `ShareSecret` from `Prescription:ShareSecret`; HMAC-SHA256 over `"{code}:{exp}"` with `FixedTimeEquals`; expired → 410, bad/partial signature → 400. |
| 3 | `ConsultationsController.cs` | `GenerateShareLink` signs the real code, returns `503 share_link_not_configured` when the secret is unset. |
| 4 | `ConsultationsController.cs` | `BuildItem` nulls a `DrugId` with no `Drugs` row (CDCI hit) and marks the line unverified, so finalize no longer hits FK `FK_PrescriptionItems_Drugs_Id`. |
| 5 | `PharmacyComplianceController.cs` | Dispense resolves each line by `DrugId` → medicine text → exact generic+strength+form; unmatched line → `400 drug_not_matched` (no more `Guid.Empty` batch insert). |
| 6 | `PharmacyComplianceController.cs` | NDPS refused from the stored prescription line; substitutions must match generic+strength+form; prescriber name/reg no read from the signed consultation; dispensed qty capped at `TotalQuantity - DispensedQuantity`; idempotency re-checked inside the transaction. |
| 7 | `PharmacyPosController.cs` | Unit price = `batch.Mrp`, GST rate = `drug.GstRate` (client values ignored); batch/drug mismatch rejected; fail-closed licence gate; refund re-checks `Refunded` inside the serialisable transaction. |
| 8 | `PharmacyBatchController.cs` | `[RequireModule(Pharmacy)]`; stock-in rejects blank batch number and past expiry, stores `SupplierLicenceNumber` + `InvoiceDate`; recall zeroes `QuantityRemaining`; adjustments on a recalled batch rejected. |
| 9 | `PharmacyCatalogController.cs` | `[RequireModule(Pharmacy)]`; substitutes = same generic + strength + form, in stock, not recalled. |
| 10 | `HospitalCrmDbContext.cs` | Unique filtered index `DispenseRecords (TenantId, IdempotencyKey)`; `DispenseItem`/`ControlledSubstanceRegister`/`DrugStockMovement`/`MedicineSearchMissLog`/`PrescriptionPrintLog` FKs → `Restrict`. |
| 11 | `DrugBatch.cs`, `PharmacyDtos.cs`, migration `20261025222055_Section4PharmacyHardening` | New `InvoiceDate`, `SupplierLicenceNumber(50)` columns; index and FK changes applied to Postgres. |
| 12 | `scripts/setup-least-privilege-db.sql` | `REVOKE UPDATE, DELETE` + `GRANT INSERT, SELECT` for `DrugStockMovements`, `MedicineSearchMissLogs`, `PrescriptionPrintLogs`. |
| 13 | `VerifyRx.tsx` | Forwards `exp`/`sig`; distinct messages for expired/forged/unknown-version links; missing registration number shows "Not recorded" instead of "VERIFIED". |
| 14 | `Section4PharmacyAuditFixesTests.cs` | 11 regression tests for the above. |

### Section 4 verification

- `dotnet build`: 0 errors, 4 pre-existing nullable warnings in `MedicinesController.cs`.
- `dotnet test`: **292 passed, 0 failed, 0 skipped** (272 before Section 4 + 9 hardening + 11 audit fixes).
- `npm run build`: success; `npm run lint`: exit 0, pre-existing warnings only.
- Migration applied: `20261025222055_Section4PharmacyHardening`; `has-pending-model-changes` → none.
- `DispenseRecords` unique index and both `DrugBatches` columns confirmed via `psql`.
- Not done: PDF/QR image rendering, pharmacy UI, invoicing for Rx dispense (P2, documented).


## 2026-10-26 - Section 5 re-verification (Billing, Payments & Financial Ledger)

Verdict: the scaffolding is real and the happy paths work, but several claims are not true as written. The two that matter in production: the invoice-finalize postings do not balance when an invoice-level discount exists, and a second click on "Confirm" can add the money twice. Both are fixed below.

Verified true (checked in code, not just docs):

- `TenantTaxProfile`, `PayeeAccount`, `CreditNote`, `FinanceLedgerEntry`, `InvoicePrintLog`, `BillingTaxEnums` exist; migration `20261026135242_Section5BillingTaxAndManualLedger` is applied.
- Draft -> Finalized state machine; re-finalize rejected; finalize assigns `max+1` per tenant/series/year inside a serializable transaction and posts ledger rows.
- Exempt-first default (`BillOfSupply`, SAC 999312, 0% GST) with per-line taxable overrides; line discount and GST rounding done server-side.
- Print writes `InvoicePrintLogs`, first copy `ORIGINAL`, later copies `DUPLICATE COPY`.
- Dynamic UPI QR builds an NPCI deep link from an active, cooled-off payee account and supports the primary/backup toggle.
- Reported vs Confirmed payment states exist; UTR is mandatory for electronic payments at/above `ThresholdHighValueUtr`; split payments are supported.
- Payee CRUD is ClinicAdmin-only, validates VPA shape, applies 24h cooling-off on create.
- `FinanceLedgerEntries` and `InvoicePrintLogs` are append-only in EF and at the DB role (`REVOKE UPDATE, DELETE ... FROM app_user`).
- Ledger endpoints exist: income, daily, daily-collection, outstanding-dues aging, journal, summary, expenses.
- `Billing.tsx` has the four tabs, QR modal, print modal and credit-note modal.

Gaps found:

| Pri | Finding |
|---|---|
| P0 | `PaymentsController.ConfirmPayment` adds `amount` to `invoice.PaidAmount` even when `req.PaymentId` is already `Completed`: a double click (or a retry) sets the invoice paid twice. There is no balance cap, no idempotency key and no transaction, so two concurrent confirms both commit. |
| P0 | The legacy `POST /invoices/{id}/payment` (`CollectPayment`) posts no `FinanceLedgerEntry` at all and skips the UTR threshold, so "all payment events post to the ledger" is false. It also uses `FindAsync`, which does not pin the tenant explicitly. |
| P0 | Finalize postings do not balance when `DiscountAmount > 0`: AR is debited `Total`, but the credits are `Subtotal + GstAmount`. The discount is never posted, so debits exceed credits by the discount. Same bug in auto-finalize. |
| P0 | Credit notes can be issued against drafts/cancelled invoices, and each note may be up to `invoice.Total`, so two notes can credit 200% of the bill. Numbering uses `CountAsync`, so any gap collides; no dual approval despite "dual-control". |
| P0 | No unique index on `(TenantId, FinancialYear, Series, InvoiceNumber)`. The gapless claim has no DB backstop. |
| P0 | `RazorpayWebhook` marks the payment completed but posts no ledger entry, and swallows every exception while returning `200`, so Razorpay never retries a failed capture. |
| P0 | `TaxCategory` is client-supplied: a receptionist can send `Exempt` on a taxable good and zero the GST. A `Taxable` line with no rate also produces 0 GST. A mixed invoice is still labelled `BillOfSupply`. |
| P1 | `PrintInvoice` prints drafts, picks an arbitrary clinic (`Clinics.FirstOrDefaultAsync`), and `PrintCount++` is not concurrency-safe. |
| P1 | `ReportPayment` silently maps an unknown method to UPI and does not cap the amount at the balance. The claimed daily cap on unconfirmed claims and spike alerts do not exist. |
| P1 | `PayeeAccountsController` has no MFA step-up, no admin alert on account change, no unique primary/backup priority guard, and validates IFSC/account number by length only. `DailyLimit`/`DailyCollected` are never enforced or updated. |
| P1 | Ledger reports: `gstCollected` counts the whole invoice GST on every partial payment (double counts), `daily-collection.reported` filters on `PaidAt` (null for reported payments, so always 0), and `summary.net` ignores credit notes. |
| P1 | Discounts: no reason required, a line discount may exceed the line amount (silently clamped), and an invoice discount above the gross is silently clamped to a zero total. |
| P2 | No PDF: `GET /invoices/{id}/print` returns JSON; the UI renders the modal. Documented, not built. |
| P2 | Patient advances/deposits, refunds (`RefundProcessed` is unused) and dual-approval thresholds are not built. |
| P2 | Numbering uses the calendar year (`INV-2026-000001`), not the Indian FY (Apr-Mar), and the rendered number ignores `Series`/`TenantId` despite the 5.4 template. |
| P2 | `Owner` is not a role (only `ClinicAdmin`); payee daily limit cannot be enforced until payments record their payee account. |
| P2 | No notification on suspected payment spikes; no bank-statement/MT940 import (deferred per 5.10). |

### Section 5 TODO

| Pri | Item | Status |
|---|---|---|
| P0 | Confirm: reject an already-confirmed payment, cap at `BalanceDue`, idempotency key, serializable transaction | DONE |
| P0 | Legacy `CollectPayment`: tenant-scoped lookup, balance cap, UTR threshold, ledger post | DONE |
| P0 | Finalize: post `DiscountAllowed` so debits = credits; one shared helper for both paths | DONE |
| P0 | Credit note: finalized-only, cumulative cap at `Total`, max-sequence numbering | DONE |
| P0 | Unique index `(TenantId, FinancialYear, Series, InvoiceNumber)` | DONE |
| P0 | Webhook: post ledger, return 500 so Razorpay retries | DONE |
| P0 | Tax guards: no exempt downgrade on a taxable clinic (unless SAC 9993), taxable needs a rate, mixed bill is `TaxInvoice` | DONE |
| P1 | Print: finalized-only, clinic from the appointment (copy-number race left as P2) | DONE |
| P1 | Report: reject unknown method and over-balance amounts, optional idempotency | DONE |
| P1 | Payee: password (+ TOTP when enrolled) step-up, admin email alert, priority guard, IFSC/account format | DONE |
| P1 | Ledger: pro-rata GST, reported filter on `ReportedAt`, net after credit notes | DONE |
| P1 | Discounts: mandatory reason, reject over-line and over-gross discounts | DONE |
| P2 | PDF, deposits, refunds, dual approval, Indian FY numbering, daily caps | OPEN (documented) |

### Fixes applied

(filled in after implementation)


### Fixes applied

| # | File | Change |
|---|---|---|
| 1 | `PaymentsController.cs` | Confirm: rejects a payment that is already `Completed`, rejects `amount > BalanceDue`, accepts an idempotency key (replay returns the same result), parses the tender strictly (400 `invalid_payment_method`), and runs inside a serializable transaction. |
| 2 | `PaymentsController.cs` | Report: rejects unknown tender, over-balance and already-paid invoices, adds idempotency; dynamic QR refuses drafts/paid/zero-amount invoices. |
| 3 | `InvoicesController.cs` | Legacy `CollectPayment`: tenant-scoped query (no `FindAsync`), balance cap, UTR threshold, and the same `PaymentConfirmed` ledger pair as the new path. |
| 4 | `InvoicesController.cs` | `PostFinalizeLedger` helper used by draft-finalize and auto-finalize: AR debit `Total`, Revenue credit `Subtotal`, GST credit, `DiscountAllowed` debit, so debits = credits. |
| 5 | `InvoicesController.cs` | Generate: empty line list, non-positive qty/price, over-line discount, over-gross discount, missing discount reason, exempt downgrade without a 9993xx SAC, taxable line without a rate; any GST makes the document a `TaxInvoice`. |
| 6 | `InvoicesController.cs` | Credit note: finalized/paid/partially-paid only, cumulative cap `Total - alreadyCredited`, MAX+1 per `CN-YYYY-` prefix instead of `CountAsync`. |
| 7 | `InvoicesController.cs` | Print: drafts/cancelled refused; clinic resolved from the invoice's appointment, not the first clinic. |
| 8 | `InvoicesController.cs` | Razorpay webhook: posts the `PaymentConfirmed` ledger pair and returns `500` on failure so Razorpay retries. |
| 9 | `HospitalCrmDbContext.cs` | Unique filtered index `(TenantId, FinancialYear, Series, InvoiceNumber)`; `CreditNote` added to the append-only change-tracker guard. |
| 10 | `PayeeAccountsController.cs` | Password re-entry + enrolled TOTP/email code step-up, admin email alert on add/update, IFSC/account-number format checks, unique active priority, cooling-off restarts on re-activation. |
| 11 | `LedgerController.cs` | Reported payments counted by `ReportedAt` (were always 0), GST pro-rata to collected amount, `summary.net` subtracts credit notes. |
| 12 | `scripts/setup-least-privilege-db.sql` | `REVOKE UPDATE, DELETE` + `GRANT INSERT, SELECT` for `CreditNotes`; applied to the dev database. |
| 13 | Migration `20261026145940_Section5BillingGuards` | Invoice-number unique index; applied. |
| 14 | `Section5BillingAuditFixesTests.cs` | 8 regression tests for double-confirm, over-balance, discount balance, credit-note caps, draft print, tax downgrade, legacy ledger, reported collection. |
| 15 | `SECTION-5-TODO.md`, `WORKFLOW.md`, `TODO.md` | Claims corrected; known limits listed; test count updated to 310. |
| 16 | `PayeeAccountsController.cs`, `PaymentsController.cs` | Found in review, after the P0/P1 fixes: payee accounts were tenant-scoped while invoices belong to a clinic, so a multi-clinic tenant could route a bill's UPI QR to a sibling clinic's bank account. Create/list/update and the priority guard are now clinic-scoped, and `GenerateDynamicQr` only offers accounts of the invoice's own clinic (falls back to the caller's clinic, then tenant-wide when neither exists). Regression test `DynamicQr_OnlyUsesTheInvoicesOwnClinicPayeeAccount`. |

### Section 5 verification

- `dotnet build`: 0 errors, same 4 pre-existing nullable warnings in `MedicinesController.cs`.
- `dotnet test`: **310 passed, 0 failed, 0 skipped** (301 baseline + 9 audit regressions).
- `npm run build`: success (chunk-size warning only); `npm run lint`: exit 0, pre-existing warnings only.
- `dotnet ef database update`: applied **both** `20261026135242_Section5BillingTaxAndManualLedger` and `20261026145940_Section5BillingGuards`. The base Section 5 migration was **not** in `__EFMigrationsHistory` before this run, so the earlier "migration applied" claim was not true on this database.
- `has-pending-model-changes`: none.
- DB checks: `IX_Invoices_TenantId_FinancialYear_Series_InvoiceNumber` exists; `app_user` has only `INSERT`/`SELECT` on `CreditNotes`.
- Not done (P2, documented): PDF, deposits, refunds, dual approval, reported-payment caps/alerts, payee daily limit, statement import, print-count race.

## 2026-10-26 — Task 1: Indian FY Numbering & Credit Note Series Reset
- Implemented `IndianFinancialYearUtils` (Apr-Mar FY, e.g. `2026-27`) with automatic sequence reset to 1 on April 1.
- Added `FinancialYear`, `Series`, `SequenceNumber` with unique index `(TenantId, FinancialYear, Series, SequenceNumber)` to `CreditNotes` and applied migration `20261026174641_Section5IndianFyAndCreditNoteNumbering`.
- Verified gapless sequence allocation and series formatting across Invoices (`INV`/`PHARM`) and Credit Notes (`CN`); 314 tests passed (added 4 new tests in `Section5IndianFyNumberingTests.cs`).




