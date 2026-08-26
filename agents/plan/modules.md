# SAMSTACK AI — Module Catalog (`plan/modules.md`)

This document defines all functional modules in the SAMSTACK AI system, their purpose, scope boundaries, database tables, and track assignments.

---

## Purpose

To provide a complete registry of all functional modules across Phase 1 (Track 1) and future expansion tracks (Tracks 2–4, Fast-Follows), maintaining strict module boundaries.

---

## Scope

Covers active Phase 1 modules (MOD-01 through MOD-07 + Cross-Cutting capabilities) and documents deferred modules (MOD-08 through MOD-26).

---

## Verified Information

### Active Phase 1 Modules (Track 1: CRM + Billing)

| Module Code | Module Name | Purpose & Features | Core Tables Involved |
|---|---|---|---|
| **MOD-01** | Identity & Access | Authentication, RBAC (3 roles), JWT RS256, staff invites, password reset | `users`, `refresh_tokens`, `password_reset_tokens`, `staff_invites` |
| **MOD-02** | Clinic Setup | Single-tenant clinic profile, operating hours, holiday dates | `clinics`, `clinic_hours`, `clinic_holidays` |
| **MOD-03** | Patients / Registration | Patient demographics, DPDP consent, search, duplicate phone check | `patients`, `patient_consent`, `patient_audit_log` |
| **MOD-04** | Appointments & Queue | Slot booking, daily schedule view, numeric queue token, cancel/reschedule | `appointments`, `appointment_history` |
| **MOD-05** | Treatment / EMR | Chief complaint, diagnosis, free-text prescriptions, treatment timeline | `consultations`, `prescriptions`, `prescription_items` |
| **MOD-06** | Billing & Payments | GST invoice generation, Razorpay payment links, cash receipts, dues report | `invoices`, `payments` |
| **MOD-07** | WhatsApp Notifications | Async event-driven WhatsApp booking confirmation and scheduled reminder | `notification_log` |

### Cross-Cutting Capabilities
- **Offline-First Sync**: IndexedDB client queue for FR-06 registration and FR-17/18 billing, server-side idempotency keys.
- **DPDP Consent & Audit**: Mandatory consent capture during registration; immutable append-only audit trail (`REVOKE UPDATE, DELETE`).
- **Notification Abstraction**: `INotificationChannel` interface isolating core workflows from WhatsApp provider logic.

---

## Implementation Details

### Deferred Expansion Modules

#### Track 1 Fast-Follow (Post-Phase 1)
- **MOD-08**: Lab Records (Orders, results, pending/completed worklist)
- **MOD-09**: Inventory (Dead / consumable / usable stock states)
- **MOD-10**: Wishlist Tracker (Doctor-flagged tasks/goals/equipment ideas)
- **MOD-11**: Finance / Accounting Ledger (Categorised income/expense, monthly closing)
- **MOD-12**: Speciality EMR Templates (Templated consult notes per specialty)
- **MOD-13**: Full Notification Rules Engine (Configurable reminder rules engine)
- **MOD-14**: Platform Admin Portal (SAMSTACK multi-tenant management & feature flags)
- **MOD-23**: Doctor Pre-Check Form (Tokenized pre-visit intake link)
- **MOD-24**: Emergency Priority Queue (Receptionist/Doctor urgent queue re-sequencing)
- **MOD-25**: Live Ticket Tracking (Real-time patient queue position page)

#### Track 2 — Pharmacy + Billing
- **MOD-15**: Pharmacy Dispensing & POS
- **MOD-16**: Pharmacy Stock & Compliance (Schedule H/H1 registers, FEFO expiry)
- **MOD-17**: Distributor Ordering (Purchase orders)

#### Track 3 — Regulated AI
- **MOD-18**: Bucket A AI (OCR, no-show prediction, administrative NLU)
- **MOD-19**: Bucket B AI (Diagnostic decision support behind CDSCO feature flags)

#### Track 4 — IPD / Inpatient
- **MOD-20**: Bed/Ward Management
- **MOD-21**: Admission & Discharge
- **MOD-22**: Nursing Charting
- **MOD-26**: Nurse Staffing & Shift Management

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=74-85) — Core capabilities table
- [`docs/samstack-ai-module-registry-v1.2.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-module-registry-v1.2.md) — Master Module Registry

---

## Dependencies

- Managed identity infrastructure for MOD-01
- PostgreSQL database engine for MOD-01 through MOD-06
- Razorpay API for MOD-06
- WhatsApp Business API for MOD-07

---

## Risks

- **Boundary Leaks**: Allowing MOD-03 (Patient) code to directly invoke MOD-06 (Billing) entities without clean API boundary interfaces.
- **Accidental Scope Creep**: Implementing MOD-15 (Pharmacy) or MOD-08 (Lab) tables inside Phase 1 migrations.

---

## Future Improvements

- Sequential implementation of MOD-23, MOD-24, and MOD-25 immediately following Phase 1 pilot validation.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Priority sequence of Track 2 (Pharmacy) vs Track 1 Fast-Follow modules following Phase 1 completion.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=74-85)
- [`docs/samstack-ai-module-registry-v1.2.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-module-registry-v1.2.md)
