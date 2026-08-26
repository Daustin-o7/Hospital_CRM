# SAMSTACK AI — Core Business Rules (`plan/business-rules.md`)

This document collects and defines all explicit business rules, clinical constraints, regulatory policies, and design principles discovered across the SAMSTACK AI codebase and specifications.

---

## Purpose

To provide a centralized reference for every domain rule, operational constraint, and regulatory requirement governing application behavior.

---

## Scope

Covers all 22 functional requirements (FR-01 to FR-22), clinical record policies, billing rules, consent constraints, and architectural disciplines.

---

## Verified Information

### 1. Architectural & Engineering Discipline Rules
- **Rule 1 (Ponytail Decision Ladder)**: Do not write new code or add libraries without evaluating: *Need -> Existing codebase -> Native platform / stdlib -> Installed package -> 1 line -> Write new*.
- **Rule 2 (Dormant Tenancy Column)**: Every tenant-scoped database table must carry a `tenant_id` column now, even though Phase 1 operates as single-tenant.
- **Rule 3 (Phase 1 Scope Isolation)**: Do not build features outside FR-01 through FR-22 (e.g. no pharmacy, no lab, no AI, no IPD).

### 2. Clinical & Patient Care Rules
- **Rule 4 (Clinical Record Immutability)**: Saved consultation notes (FR-14) and prescriptions (FR-15) can NEVER be edited or overwritten in place. Any modification MUST create a new versioned row with `previous_version_id` referencing the original.
- **Rule 5 (Mandatory Consent)**: A patient record CANNOT be created without an accompanying DPDP consent record (`patient_consent`) saved in the same transaction (FR-09).
- **Rule 6 (Prescription Dependency)**: Prescriptions MUST be linked to a valid consultation record; freestanding prescriptions are strictly prohibited.
- **Rule 7 (Patient Demographics Deduplication)**: Patient registration (FR-06) must execute a phone number duplicate check prior to persistence.

### 3. Queue & Appointment Rules
- **Rule 8 (Race-Condition Free Slot Booking)**: Slot double-booking MUST be prevented at the database level via a unique index `(doctor_id, date, time_slot)` where `status != cancelled` (FR-10).
- **Rule 9 (Daily Sequential Queue Tokens)**: Token numbers reset to 1 at midnight daily. Tokens are assigned ONLY when a patient is marked `checked_in` (FR-12).
- **Rule 10 (Existing Bookings Integrity)**: Modifying clinic working hours (FR-05) does NOT auto-cancel existing appointments outside the new hours; they must be flagged for manual review.

### 4. Billing, Invoicing & Payments Rules
- **Rule 11 (Gapless Invoice Numbers)**: Invoices (FR-17) MUST generate sequential, gapless invoice numbers per clinic for GST compliance. Invoices cannot be deleted; cancellations issue credit notes.
- **Rule 12 (Automatic GST Computation)**: GST amounts MUST be calculated automatically by the server based on line items, never manually entered by staff.
- **Rule 13 (Webhook Signature Verification)**: Razorpay webhooks (FR-18) MUST verify HMAC signatures against raw request payloads before marking invoices paid.
- **Rule 14 (Idempotent Webhook & Payment Handling)**: Duplicate payment webhooks MUST be rejected as no-ops using unique `idempotency_key` constraints.

### 5. Messaging & Notification Rules
- **Rule 15 (Event-Driven Async Isolation)**: Booking confirmation and reminder notifications (FR-20/21) fire asynchronously. Notification failures MUST NEVER block or roll back appointment bookings.

### 6. Security & Audit Rules
- **Rule 16 (Append-Only Audit Logs)**: `patient_audit_log` and `patient_consent` tables MUST be append-only, enforced at the DB role level (`REVOKE UPDATE, DELETE`).
- **Rule 17 (30-Minute Inactivity Policy)**: Session inactivity timeout of 30 minutes applies strictly to Doctor and Clinic Admin roles. Receptionist sessions do not expire on inactivity (FR-01).

---

## Implementation Details

```
                    [ Business Rule Check Engine ]
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      ▼                           ▼                           ▼
[ Clinical Rules ]        [ Invoicing Rules ]       [ Security Rules ]
 - Mandatory Consent       - Gapless Inv #           - Append-Only Audit
 - Versioned Amendments    - Auto GST Calc           - 30-min Inactivity
 - Patient Phone Dedup     - Webhook Signature       - Server-side RBAC
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md) — Authoritative spec
- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md) — Project constraints
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Implementation rules

---

## Dependencies

- PostgreSQL database constraints
- Razorpay Webhook Verification Engine
- Managed Identity RS256 token validator

---

## Risks

- **Bypassing Immutability**: Attempting to implement UPDATE queries on consultation notes or audit tables.
- **Cascading WhatsApp Failures**: Synchronously awaiting WhatsApp API HTTP responses inside appointment booking transactions.

---

## Future Improvements

- Automated domain-rule validator in Entity Framework `DbContext.SaveChanges` interceptor.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Legal confirmation on retaining patient data after explicit DPDP consent withdrawal request.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)
- [`AGENTS.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/AGENTS.md)
