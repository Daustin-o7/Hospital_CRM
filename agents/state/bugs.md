# System State: Issue Register & Contradictions Log (`state/bugs.md`)

This document records tracked defects, edge case bug risks, and resolved specification contradictions for SAMSTACK AI.

---

## Purpose

To track resolved template contradictions, document known bug risks, and ensure edge cases identified during specification writing are systematically mitigated.

---

## Scope

Covers all 22 functional requirements (FR-01 through FR-22), resolved specification conflicts, and potential edge-case bug patterns.

---

## Verified Information

### Resolved Specification Contradictions (FRD Section 9)

1. **Zero-Cost Mandate vs Managed Identity**:
   - *Conflict*: Mandate for zero infrastructure cost vs managed identity provider (Azure Entra External ID).
   - *Resolution*: Zero-cost principle applies to infrastructure & framework layers (.NET, React, Postgres, Redis), NOT to the documented fix for the identity single-point-of-failure risk. Managed identity stays.
2. **Zero-Cost Mandate vs Transactional Services (WhatsApp & Razorpay)**:
   - *Conflict*: Zero-cost mandate vs transactional fees (Meta per-message fees, Razorpay per-txn fees).
   - *Resolution*: Transactional providers are core product capabilities, excluded from infrastructure zero-cost constraint.
3. **Session Inactivity vs Refresh Token Lifetimes**:
   - *Conflict*: 30-minute inactivity timeout vs 7-30 day rotated refresh tokens.
   - *Resolution*: Layered policy. Refresh token rotation handles token theft. A separate 30-minute last-activity check forces re-login for Doctor & Admin roles specifically.
4. **Generic 7-Year Data Retention vs DPDP Data Minimization**:
   - *Status*: Flagged as provisional. Template's "7 years" is a generic corporate default. Needs explicit legal confirmation for Indian medical records before hardcoding DB retention crons.

---

## Implementation Details

### Identified Edge Case Bug Prevention List

- **Edge Case 1 (FR-01 Account Lockout)**: Consecutive failed logins (5x in 10 mins) must return HTTP 423 Account Locked with `retryAfterSeconds: 900`.
- **Edge Case 2 (FR-05 Slot Collisions)**: Editing working hours mid-day must NOT auto-cancel existing appointments; flag for manual review.
- **Edge Case 3 (FR-06 Phone Deduplication)**: Patient registration must run duplicate check *before* saving, capturing DPDP consent in the same transaction.
- **Edge Case 4 (FR-10 Concurrent Double Booking)**: Simultaneous slot bookings must trigger DB unique index violation (`uq_doctor_slot`) returning HTTP 409 Conflict (`slot_unavailable`).
- **Edge Case 5 (FR-14 Clinical Amendment)**: Edits to saved consultation notes must issue a new version row with `previous_version_id` set, never updating the original row.
- **Edge Case 6 (FR-18 Duplicate Webhook)**: Replaying Razorpay webhook payloads must be rejected as a no-op using unique `idempotency_key` constraints.

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=100-115) — Contradictions Section (§9)

---

## Dependencies

- PostgreSQL Unique Index Engine
- ASP.NET Core Middleware Exception Handlers

---

## Risks

- **Silent Data Overwrite**: Attempting to edit clinical notes in-place without versioning.
- **Unverified Retentions**: Enforcing hard data deletion after 7 years without legal confirmation.

---

## Future Improvements

- Automated integration test suite verifying every edge case listed in `state/bugs.md`.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Legal confirmation on Indian medical record data retention period.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=100-115)
