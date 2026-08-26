# SAMSTACK AI — Permission Matrix (`plan/permission-matrix.md`)

This document defines the server-enforced Role-Based Access Control (RBAC) matrix across all functional requirements and user roles in SAMSTACK AI Phase 1.

---

## Purpose

To provide an explicit, unambiguous mapping of endpoints, domain operations, and data access permissions across the system's three defined user roles.

---

## Scope

Covers all 22 functional requirements (FR-01 through FR-22) and Phase 1 roles: **Clinic Admin**, **Doctor**, and **Receptionist**.

---

## Verified Information

### User Roles Overview
- **Clinic Admin**: Practice owner or manager (solo practitioners hold both Clinic Admin and Doctor roles). Full access to all modules, financial analytics, staff invitations, and clinic configuration.
- **Doctor**: Clinical staff. Full access to patient history, appointments, consultations, and prescriptions. Read-only access to billing for their own patients. No access to staff invites or clinic settings.
- **Receptionist**: Front-desk staff. Full access to patient registration, appointment booking, daily queue management, and invoicing. **ZERO access to clinical consultation notes or aggregate financial reports**.

---

## Implementation Details

### Master RBAC Matrix

| FR Code | Functional Requirement | Endpoint / Capability | Clinic Admin | Doctor | Receptionist | Notes & Boundaries |
|---|---|---|:---:|:---:|:---:|---|
| **FR-01** | User Login | `POST /api/v1/auth/login` | ✅ | ✅ | ✅ | 30-min inactivity timeout for Doctor & Admin only |
| **FR-02** | Role Enforcement | Middleware Role Verification | ✅ | ✅ | ✅ | Server-side enforcement on all endpoints |
| **FR-03** | Password Reset | `POST /api/v1/auth/password-reset/*` | ✅ | ✅ | ✅ | Self-service email reset |
| **FR-04** | Staff Invitation | `POST /api/v1/staff/invite` | ✅ | ❌ | ❌ | Admin only. Cannot invite co-admins in V1 |
| **FR-05** | Clinic Setup | `PUT /api/v1/clinic/profile` | ✅ | ❌ (Read) | ❌ (Read) | Admin writes; Doctor/Receptionist read hours |
| **FR-06** | Register Patient | `POST /api/v1/patients` | ✅ | ✅ | ✅ | Mandatory consent capture inline |
| **FR-07** | Search / View Patient | `GET /api/v1/patients/search` | ✅ | ✅ | ✅ (Demographics) | Server filters out clinical notes for Receptionist |
| **FR-08** | Edit Patient Details | `PATCH /api/v1/patients/{id}` | ✅ | ✅ | ✅ | Triggers append-only audit entry |
| **FR-09** | Capture Consent | Integrated in FR-06 | ✅ | ✅ | ✅ | Consent record creation |
| **FR-10** | Book Appointment | `POST /api/v1/appointments` | ✅ | ✅ | ✅ | Race-condition safe slot booking |
| **FR-11** | Daily Schedule | `GET /api/v1/appointments` | ✅ | ✅ | ✅ | Auto-refreshing daily queue |
| **FR-12** | Queue Token | `POST /api/v1/appointments/{id}/checkin` | ✅ | ✅ | ✅ | Assigns sequential daily token |
| **FR-13** | Reschedule / Cancel | `PATCH /api/v1/appointments/{id}` | ✅ | ✅ | ✅ | Preserves reschedule history |
| **FR-14** | Create Consult Note | `POST /api/v1/appointments/{id}/consultation` | ❌ (Unless Doctor) | ✅ | ❌ | **Receptionist 403 Forbidden** |
| **FR-14** | Amend Consult Note | `PATCH /api/v1/consultations/{id}` | ❌ (Unless Doctor) | ✅ (Author/Same Clinic) | ❌ | Versioned amendment row created |
| **FR-15** | Write Prescription | `POST /api/v1/consultations/{id}/prescription` | ❌ (Unless Doctor) | ✅ | ❌ | Linked to consultation ID |
| **FR-16** | Treatment Timeline | `GET /api/v1/patients/{id}/history` | ✅ | ✅ | ❌ | **Receptionist 403 Forbidden** |
| **FR-17** | Generate Invoice | `POST /api/v1/invoices` | ✅ | ✅ | ✅ | Gapless sequential invoice number |
| **FR-18** | Collect Payment | `POST /api/v1/invoices/{id}/payment` | ✅ | ✅ | ✅ | Cash direct / Razorpay link |
| **FR-19** | Outstanding Dues | `GET /api/v1/invoices?status=unpaid` | ✅ (All Patients) | ✅ (Own Patients) | ❌ (Aggregate) | **Receptionist cannot view aggregate dues** |
| **FR-20** | WhatsApp Confirm | Async Handler Trigger | System | System | System | System-triggered on FR-10 booking |
| **FR-21** | WhatsApp Reminder | Scheduled Cron Job | System | System | System | System-triggered pre-visit reminder |
| **FR-22** | Offline Sync | IndexedDB + Idempotency | ✅ | ✅ | ✅ | Scope limited to registration & billing |

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=86-98) — User Roles & Access Responsibilities
- [`docs/samstack-ai-auth-and-ia-v0.1.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-auth-and-ia-v0.1.md) — Auth and IA design baseline

---

## Dependencies

- ASP.NET Core Policy-Based Authorization Framework
- JWT `role` claim decoder

---

## Risks

- **Client-Side Bypass**: Failing to enforce role checks on backend endpoints, assuming front-end button hiding is sufficient.
- **Solo Practitioner Confusion**: Solo doctors failing to log in with Clinic Admin role and being unable to configure clinic hours.

---

## Future Improvements

- Granular custom roles (Pharmacist for Track 2 MOD-15, Nurse for Track 4 MOD-26).

---

## Unknown Information

> UNKNOWN — Requires human confirmation: UX design confirmation on solo doctor dual-role default toggle in settings.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=86-98)
- [`docs/samstack-ai-auth-and-ia-v0.1.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/docs/samstack-ai-auth-and-ia-v0.1.md)
