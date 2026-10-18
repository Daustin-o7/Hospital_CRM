# Hospital CRM — Web Backend Implementation Plan

## Purpose
This plan addresses the web backend (`.NET 10 / ASP.NET Core Minimal APIs / EF Core 10 / PostgreSQL / Typesense`) items that require correction, completion, or cleanup before the system can be considered production-ready for Phase 1 (FR-01–22) and Phase 2 (MOD-08–25). The Mobile App work is deliberately held off per your request.

---

## Overview of Current State
- **Build**: `dotnet build` passes, 0 errors, 0 warnings.
- **Recent changes** (uncommitted): `PatientsController.cs`, `PatientSearchService.cs`, `TypesensePatientDocument.cs`, plus stray PIN-lockout files.
- **Scope flag**: Several recent changes add medicine/pharmacy search (`/api/v1/patients/medicines/search`) which falls under **Track 2 (Pharmacy)** — explicitly **out of scope per FRD §5.2**. This plan marks each such item and recommends keeping it only if the scope is formally expanded.
- **Git branch**: `mobile-implementation` (diverged from main). All changes below target the default branch or are self-contained edits.

---

## Priority 1: Typesense Medicine Search — Route and Schema Fix

### Problem
- Medicine search endpoint at `/api/v1/patients/medicines/search` (nested under PatientsController).
- `TypesenseMedicineDocument` expects `manufacturer` and `popularity_count` — fields not present on the `Drug` entity.
- Only the `patients` collection is ensured via `EnsureCollectionAsync`; the `medicines` collection is not initialized.
- The route `/api/v1/patients/medicines/search` conflates two concerns; the plan requires a dedicated `/api/v1/medicines/search`.

### Acceptance Criteria (from FRD / MOD mapping)
- `GET /api/v1/medicines/search` returns medicine search results.
- Typesense `medicines` collection is created/ ensured on startup.
- Document fields map to the `Drug` entity schema.
- PostgreSQL fallback when Typesense is unavailable.

### Changes Required
1. **Create `MedicinesController.cs`** at `Controllers/MedicinesController.cs` with `[Route("api/v1/[controller]")]` and `[HttpGet("search")]` → route becomes `GET /api/v1/medicines/search`.
2. **Update `TypesenseMedicineDocument`** to use fields that exist on `Drug`: `name`, `generic_name`, `strength`, `form`, `manufacturer` (if present; otherwise remove or map from `Drug.CommonBrands`), `popularity_count` (remove or add to `Drug`).
3. **Add `EnsureCollectionAsync` for medicines** in `Program.cs` startup (mirror the patient collection ensure).
4. **Update `MedicineSearchAsync`** in `PatientSearchService.cs` to use the new `MedicinesController` route or a standalone service.
5. **Fix the PostgreSQL fallback** in the medicine search to map `Drug.CommonBrands` → `Manufacturer` correctly (document this as a known simplification with upgrade path).
6. **If pharmacy/medicine features are out of scope** (FRD §5.2): revert the medicine search changes entirely and remove the `MedicinesCollection` config. If scope is expanded later, implement from scratch.

### Deliverable
- Either a working `/api/v1/medicines/search` endpoint with correct schema, OR removal of medicine search if scope stays restricted.

---

## Priority 2: Backend Sync Push Endpoint — Contract and Data Integrity

### Problem (in `PatientsController.cs` sync/push action, lines ~315–379)
Multiple defects prevent the sync endpoint from satisfying the offline/outbox contract:

| Defect | Current Behavior | Required |
|---|---|---|
| `SyncPushRequest` shape | Top-level `Type` field is unused; per-item `Type` also present — redundant | Unify: remove top-level `Type`, or have per-item `Type` only |
| Invoice sync (`case 2`) | `TODO: Implement Invoice sync when billing module is built` — silently skips | Implement invoice sync with idempotency key, payload validation |
| Idempotency check | `FirstOrDefaultAsync(p => p.Id == item.Id)` — checks entity ID, not `IdempotencyKey` | Check `IdempotencyKey` against existing records; if a key exists, reject or return the prior record as already processed |
| Overwrite existing key | `existingPatient.IdempotencyKey = item.IdempotencyKey` mutates key without verifying same operation | Do not overwrite; if key exists and differs, return `Conflict` or `AlreadyProcessed` |
| Null/invalid payloads | Silently `continue` (skipped, never counted as failed) | Count and return per-item `Failed` results with error reason |
| Transaction scope | Each item calls `SaveChangesAsync` independently — partial batch success with no atomicity | Wrap entire batch in `using var tx = await _db.Database.BeginTransactionAsync(ct);`; commit on full success, rollback on any failure |
| Per-item results | No return model — batch just "completes" | Return `SyncPushResponse` with `List<SyncPushResult>`: `{ Success, Failed, Id, ErrorMessage }` per item |
| Validation | No validation of items, payload size, required fields, key format, phone conflicts, consent, tenant, status | Add comprehensive validation before processing each item |
| `CreatedAt` truncation | `DateOnly` converted to midnight via `new DateTimeOffset(..., 0,0,0,0)` | Use `DateTimeOffset` / `DateTime` with full UTC timestamp; preserve time component |

### Acceptance Criteria
- `POST /api/v1/patients/sync/push` accepts a batch of patient/invoice mutations.
- Each item is validated; invalid items return a `Failed` result, not silently skipped.
- Idempotency is enforced by `IdempotencyKey` — duplicate keys return the existing record's summary.
- Invoice mutations (`case 2`) are fully implemented, not a TODO.
- The batch is transactional: either all items succeed or none do.
- Per-item results are returned in the response.
- Required fields, key format, duplicate-phone conflicts, consent presence, tenant ownership, and status values are validated.

### Changes Required
1. **Redefine DTOs** in `PatientsController.cs` (or a shared `SyncModels.cs`):
   - `SyncPushRequest`: `{ List<SyncPushItem> Items }` — remove top-level `Type`.
   - `SyncPushItem`: `{ string IdempotencyKey, string EntityType, object Payload, DateTimeOffset CreatedAt, string Id }`.
   - `SyncPushResult`: `{ bool Success, string Id, string ErrorMessage }`.
   - `SyncPushResponse`: `{ bool OverallSuccess, List<SyncPushItemResult> Items }`.
2. **Implement invoice sync** (`case 2`) with full payload validation and idempotency key check.
3. **Rewrite the batch processing** loop:
   - Begin transaction.
   - For each item: validate, check idempotency key, process or return `Failed`.
   - On success: commit transaction; on any failure: rollback.
4. **Add validation** helpers for:
   - Payload size limits.
   - Required fields per entity type.
   - Idempotency key format (regex: `IDEMP-PAT-{UUID}` or `IDEMP-INV-{UUID}`).
   - Duplicate phone detection.
   - Consent presence for patient creation.
   - Tenant ownership (`tenant_id` check if non-`Guid.Empty`).
   - Status value enum validation.
5. **Fix `CreatedAt` deserialization** to use `DateTimeOffset` instead of `DateOnly` truncation.

### Deliverable
- A corrected `POST /api/v1/patients/sync/push` endpoint that is transactional, validates per-item, returns per-result, and enforces idempotency by key.

---

## Priority 3: Patient Search and Registration — Remove Hardcoded Data

### Problem
- `PatientSearchScreen.tsx` initializes three hardcoded patients locally; never calls the real search API.
- `PatientRegistrationScreen.tsx` uses synthetic duplicate rules (phone ends in `1234` / name contains `"duplicate"`) instead of calling `/api/v1/patients/check-duplicate`.
- Registration payload includes `guardianName` — not in the current backend patient contract.
- No consent object is sent during registration (DPDP requirement).
- No real UUID idempotency key is generated.

### Acceptance Criteria
- Patient search calls the Typesense-backed `GET /api/v1/patients/search` (composite: name+DOB+last 4 phone) or the API client.
- Patient registration calls `/api/v1/patients/check-duplicate` before creation.
- Duplicate confirmation dialog uses server-side duplicate check, not synthetic rules.
- Registration payload does not include `guardianName` (unless added to the backend contract).
- A consent object is included in the registration payload.
- A real UUID idempotency key is generated and sent.

### Changes Required
1. **`PatientSearchScreen.tsx`**:
   - Replace the hardcoded `INITIAL_PATIENTS` state and local `FlatList` filtering with a call to the API search endpoint.
   - On search query, fetch from `GET /api/v1/patients/search` with the query as a composite filter (name+phone+DOB).
   - Display results from the API response.
   - On "New Patient" press, navigate to registration.

2. **`PatientRegistrationScreen.tsx`**:
   - Remove the synthetic duplicate check (the `if (phone.endsWith('1234') ...)` block).
   - Before calling the API, call `GET /api/v1/patients/check-duplicate` with the phone/name.
   - Show the server's duplicate result (or proceed if none).
   - Remove `guardianName` from the payload (or add it to the backend Patient model if required).
   - Add a `consent` object to the payload: `{ type: 'DPDP', date: ISOString, purpose: 'OPD registration' }`.
   - Generate a UUID v4 idempotency key (`Guid.NewGuid()`) and include it in the payload.
   - Send the payload to `POST /api/v1/patients` with the idempotency key.

3. **Typesense duplicate check** — Ensure `CheckDuplicatesAsync` in `PatientSearchService.cs` properly filters by `tenant_id` and returns a boolean/decision that the registration screen can use.

### Deliverable
- Patient search uses live API, not hardcoded list.
- Registration uses server-side duplicate check, not synthetic rules.
- Consent and idempotency key are part of the registration flow.

---

## Priority 4: Backend Hygiene — Medicine Reindexing and Indexing Pattern

### Problem
- `TypesenseHangfireJobs.cs` only reindexes `patients` nightly; no job for `medicines`.
- Fire-and-forget `_ = _search.IndexAsync(patient, ct)` in the patient controller uses a detached task on the request's cancellation token, which may cancel indexing when the request ends.

### Acceptance Criteria
- A Hangfire recurring job reindexes the `medicines` collection nightly (same 02:00 time).
- Patient indexing uses a durable background queue, not a detached task on the request cancellation token.

### Changes Required
1. **Add medicine reindex job** in `TypesenseHangfireJobs.cs` (or create a second job class).
2. **Replace fire-and-forget indexing** with a queued approach: push the patient document to a background queue (Hangfire `Background job` or an in-process queue) that processes asynchronously without tying to the request cancellation token.

### Deliverable
- Nightly reindex covers both `patients` and `medicines` collections.
- Indexing during patient creation is handled via a background job, not a fire-and-forget task.

---

## Priority 5: Repo Hygiene — Cleanup Stray Files and Add .gitignore

### Problem
- Stray PIN-lockout directory: `frontend/src/services pin lockout/` (space in name, broken duplicate with missing React import, hardcoded `'1234'`, `setPIN` ignores input, `switchStaff()` always verifies `'1234'`).
- Another duplicate: `frontend/src/services/pinLockoutService.ts` (same issues).
- `MobileApp` directory is not a git repository.
- No `.gitignore` to exclude `node_modules/`, `android/.gradle/`, `android/build/`, `android/local.properties`, `.idea/`, and copied `dist/`.
- Recent backend changes are uncommitted.

### Acceptance Criteria
- Stray PIN-lockout files are deleted.
- `.gitignore` is added at the repo root excluding standard build/cache artifacts.
- `MobileApp` is initialized as a git repo (or the existing repo is cleaned).
- All recent backend changes are committed with descriptive messages.

### Changes Required
1. **Delete** `frontend/src/services pin lockout/` and `frontend/src/services/pinLockoutService.ts` (one PIN implementation only; will be addressed in the mobile plan separately).
2. **Add `.gitignore`** at the Hospital_CRM root (or per-project) with:
   ```
   node_modules/
   android/.gradle/
   android/build/
   android/local.properties
   *.db
   *.log
   dist/
   *.pem
   .idea/
   ```
3. **Init git** in `MobileApp` if not already, or add it to the main repo's ignore.
4. **Commit** the backend changes (Typesense fixes, sync endpoint fixes, etc.) with clear messages.

### Deliverable
- Clean repo with no stray files, proper `.gitignore`, and committed changes.

---

## Priority 6: Typesense Medicine Collection Initialization (if scope permits)

### Problem (only if medicine search from Priority 1 is kept)
- `EnsureCollectionAsync` is only called for `patients`, not `medicines`.
- Without initialization, the first medicine search will fail with a collection-not-found error.

### Acceptance Criteria (if keeping medicine search)
- `EnsureCollectionAsync` is called for both `patients` and `medicines` collections on API startup.
- The medicines collection has proper field definitions matching `TypesenseMedicineDocument`.

### Changes Required
1. In `Program.cs` startup, add: `await _typesenseClient.EnsureCollectionAsync<TypesenseMedicineDocument>(ct);`
2. Ensure the `medicines` collection in Typesense has the correct schema (facet for `name`, `generic_name`, etc.).

### Deliverable
- Typesense `medicines` collection is auto-created on first API start.

---

## Summary of Changes by Priority

| # | Priority | Area | Key Deliverable |
|---|---|---|---|
| 1 | P1 | Typesense medicine search | `/api/v1/medicines/search` with correct schema, or removal if out of scope |
| 2 | P2 | Sync push endpoint | Transactional batch, idempotency by key, invoice validation, per-item results |
| 3 | P3 | Patient search/registration | Live API calls, server duplicate check, consent + idempotency key |
| 4 | P4 | Backend hygiene | Medicine reindex job, durable indexing queue |
| 5 | P5 | Repo hygiene | Delete stray PIN files, `.gitignore`, commit backend changes |

---

## Next Steps (After Plan Approval)

1. **User reviews this plan** — confirm which Priority 1 option (keep medicine search with route/fix, or revert if out of scope).
2. **Implement Priority 1** — create `MedicinesController.cs`, update `TypesenseMedicineDocument`, add `EnsureCollectionAsync` for medicines.
3. **Implement Priority 2** — rewrite the sync/push endpoint with unified DTOs, transactional processing, validation, and invoice sync.
4. **Implement Priority 3** — replace hardcoded search/registration with real API calls, remove synthetic duplicates, add consent and idempotency key.
5. **Implement Priority 4** — add medicine reindex Hangfire job, replace fire-and-forget with queued indexing.
6. **Implement Priority 5** — delete stray PIN files, add `.gitignore`, commit all changes.
7. **Optional**: If pharmacy/medicine scope is expanded per FRD §5.2, implement the full Track 2 feature set; otherwise keep the reversion path.

---

## Scope Note: Pharmacy / Medicines (FRD §5.2)
The recent code additions that introduce `TypesenseMedicineDocument`, `MedicineSearchAsync`, and the `/api/v1/patients/medicines/search` route fall under **Track 2 (Pharmacy)** — explicitly out of scope for Phase 1 (FR-01–22) and the 9 Phase 2 modules (MOD-08–25) per FRD §5.2. 

- If the product decision is to **keep** these features, implement them as described in this plan.
- If the product decision is to **remove** them, revert the medicine-related changes and remove the `MedicinesCollection` config, returning the endpoint to its pre-existing state.

Please confirm the scope decision before proceeding with Priority 1.

---

*End of Implementation Plan*