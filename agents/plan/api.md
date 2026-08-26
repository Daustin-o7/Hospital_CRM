# SAMSTACK AI — Complete API Inventory (`plan/api.md`)

This document defines the complete, verified API inventory for SAMSTACK AI Phase 1 requirements (FR-01 through FR-22).

---

## Purpose

To document every API endpoint in the system, its HTTP method, URL route, authentication requirement, authorized roles, request/response DTOs, validation rules, status codes, database interactions, and calling services.

---

## Scope

Covers all public and internal REST endpoints specified in `samstack-ai-frd-phase1-FINAL.md` for FR-01 through FR-22.

---

## Verified Information

### Complete Endpoint Catalog

#### 1. Authentication & Staff Management (MOD-01)
- **POST `/api/v1/auth/login`** (FR-01)
  - **Auth**: Anonymous | **Roles**: All
  - **Request**: `{ "email": "string", "password": "string" }`
  - **Response 200**: `{ "accessToken": "jwt...", "refreshToken": "opaque...", "expiresIn": 900, "user": { "id": "uuid", "name": "string", "role": "clinic_admin|doctor|receptionist" } }`
  - **Responses**: 401 `invalid_credentials`, 423 `account_locked` (retryAfterSeconds: 900)
  - **DB Usage**: Queries `users` by email, updates `failed_login_count` / `locked_until`, inserts `refresh_tokens`.

- **POST `/api/v1/auth/password-reset/request`** (FR-03)
  - **Auth**: Anonymous | **Roles**: All
  - **Request**: `{ "email": "string" }`
  - **Response 200**: Generic success message (no email enumeration).

- **POST `/api/v1/auth/password-reset/confirm`** (FR-03)
  - **Auth**: Anonymous | **Roles**: All
  - **Request**: `{ "token": "string", "newPassword": "string" }`
  - **Response 200**: Password updated | **Response 400**: `invalid_or_expired`
  - **DB Usage**: Validates `password_reset_tokens`, updates `users.password_hash`, revokes `refresh_tokens`.

- **POST `/api/v1/staff/invite`** (FR-04)
  - **Auth**: JWT | **Roles**: Clinic Admin
  - **Request**: `{ "name": "string", "email": "string", "role": "doctor|receptionist" }`
  - **Response 201**: `{ "inviteId": "uuid", "expiresAt": "iso8601" }`
  - **DB Usage**: Inserts row into `staff_invites`.

#### 2. Clinic Setup (MOD-02)
- **PUT `/api/v1/clinic/profile`** (FR-05)
  - **Auth**: JWT | **Roles**: Clinic Admin
  - **Request**: `{ "name": "string", "workingHours": [{"day":"mon","open":"09:00","close":"18:00"}], "holidays": ["2026-10-02"] }`
  - **Response 200**: Profile updated
  - **DB Usage**: Updates `clinics`, `clinic_hours`, `clinic_holidays`.

#### 3. Patient Management (MOD-03)
- **POST `/api/v1/patients`** (FR-06, FR-09, FR-22)
  - **Auth**: JWT | **Roles**: Receptionist, Doctor, Clinic Admin
  - **Header**: `X-Idempotency-Key` (Optional UUID for FR-22 offline sync)
  - **Request**: `{ "name": "string", "phone": "string", "dob": "date|null", "approxAge": "int|null", "gender": "string", "address": "string|null", "consent": { "accepted": true, "purpose": "care_delivery" } }`
  - **Response 201**: `{ "patientId": "uuid", "possibleDuplicateOf": "uuid|null" }`
  - **DB Usage**: Deduplicates on `phone`, inserts `patients`, `patient_consent` in single transaction.

- **GET `/api/v1/patients/search?q={string}`** (FR-07)
  - **Auth**: JWT | **Roles**: Receptionist (list only), Doctor, Clinic Admin
  - **Response 200**: `[{ "id": "uuid", "name": "string", "phone": "string", "age": 35 }]`
  - **DB Usage**: Queries `patients` using `phone` index or `name` trigram index.

- **GET `/api/v1/patients/{id}`** (FR-07)
  - **Auth**: JWT | **Roles**: Receptionist (demographics/appointments only), Doctor, Clinic Admin (full profile)
  - **Response 200**: Patient detail shape filtered server-side based on caller's role.

- **PATCH `/api/v1/patients/{id}`** (FR-08)
  - **Auth**: JWT | **Roles**: Receptionist, Doctor, Clinic Admin
  - **Request**: `{ "field": "value" }`
  - **Response 200**: Updated record
  - **DB Usage**: Updates `patients`, appends entry to `patient_audit_log`.

#### 4. Appointments & Queue (MOD-04)
- **POST `/api/v1/appointments`** (FR-10, FR-20)
  - **Auth**: JWT | **Roles**: Receptionist, Doctor, Clinic Admin
  - **Request**: `{ "patientId": "uuid", "date": "2026-09-01", "time": "10:30", "type": "scheduled|walkin" }`
  - **Response 201**: `{ "appointmentId": "uuid", "queueToken": "int|null" }` | **Response 409**: `{ "error": "slot_unavailable" }`
  - **DB Usage**: Inserts `appointments` (enforces unique slot constraint), triggers async `AppointmentConfirmed` WhatsApp event.

- **GET `/api/v1/appointments?date={date}`** (FR-11)
  - **Auth**: JWT | **Roles**: All
  - **Response 200**: Ordered list of appointments with status and token numbers.

- **POST `/api/v1/appointments/{id}/checkin`** (FR-12)
  - **Auth**: JWT | **Roles**: Receptionist, Doctor, Clinic Admin
  - **Response 200**: `{ "queueToken": 7 }`
  - **DB Usage**: Computes next daily token number, updates `appointments.status` to `checked_in` and sets `queue_token`.

- **PATCH `/api/v1/appointments/{id}`** (FR-13)
  - **Auth**: JWT | **Roles**: Receptionist, Doctor, Clinic Admin
  - **Request**: `{ "action": "reschedule", "newDate": "...", "newTime": "..." }` OR `{ "action": "cancel", "reason": "string|null" }`
  - **Response 200**: Appointment updated
  - **DB Usage**: Updates `appointments`, inserts row into `appointment_history`.

#### 5. Consultations & Prescriptions (MOD-05)
- **POST `/api/v1/appointments/{id}/consultation`** (FR-14)
  - **Auth**: JWT | **Roles**: Doctor
  - **Request**: `{ "chiefComplaint": "string", "observations": "string", "diagnosis": "string" }`
  - **Response 201**: `{ "consultationId": "uuid" }`
  - **DB Usage**: Inserts `consultations` record with version 1.

- **PATCH `/api/v1/consultations/{id}`** (FR-14)
  - **Auth**: JWT | **Roles**: Doctor
  - **Request**: `{ "amendment": "string", "reason": "string" }`
  - **Response 200**: `{ "consultationId": "uuid", "version": 2 }`
  - **DB Usage**: Inserts new version row into `consultations` with `previous_version_id`. Original is untouched.

- **POST `/api/v1/consultations/{id}/prescription`** (FR-15)
  - **Auth**: JWT | **Roles**: Doctor
  - **Request**: `{ "items": [{ "medicine": "string", "dosage": "string", "frequency": "string", "duration": "string" }] }`
  - **Response 201**: `{ "prescriptionId": "uuid" }`
  - **DB Usage**: Inserts `prescriptions` and `prescription_items`.

- **GET `/api/v1/patients/{id}/history`** (FR-16)
  - **Auth**: JWT | **Roles**: Doctor, Clinic Admin (Receptionist 403 Forbidden)
  - **Response 200**: Chronological timeline of consultations and prescriptions.

#### 6. Invoicing & Payments (MOD-06)
- **POST `/api/v1/invoices`** (FR-17, FR-22)
  - **Auth**: JWT | **Roles**: Receptionist, Doctor, Clinic Admin
  - **Header**: `X-Idempotency-Key` (Optional UUID for FR-22 offline sync)
  - **Request**: `{ "appointmentId": "uuid", "lineItems": [{ "description": "string", "amount": 500.00 }] }`
  - **Response 201**: `{ "invoiceId": "uuid", "invoiceNumber": "INV-2026-001", "gstAmount": 90.00, "total": 590.00 }`
  - **DB Usage**: Inserts `invoices` with gapless sequence number.

- **POST `/api/v1/invoices/{id}/payment`** (FR-18)
  - **Auth**: JWT | **Roles**: Receptionist, Doctor, Clinic Admin
  - **Request**: `{ "method": "cash|razorpay", "amount": 590.00 }`
  - **Response 200 (Cash)**: `{ "status": "paid" }`
  - **Response 200 (Razorpay)**: `{ "paymentLinkUrl": "https://razorpay.com/pay/..." }`
  - **DB Usage**: Inserts `payments` record with `idempotency_key`.

- **POST `/api/v1/webhooks/razorpay`** (FR-18)
  - **Auth**: Razorpay HMAC Signature Header Verification | **Roles**: System Webhook
  - **Request**: Raw JSON Razorpay webhook event body
  - **Response 200**: `{ "status": "processed" }`
  - **DB Usage**: Verifies HMAC, checks `idempotency_key`, marks `payments.status` and `invoices.status` as `paid`.

- **GET `/api/v1/invoices?status=unpaid`** (FR-19)
  - **Auth**: JWT | **Roles**: Clinic Admin (all patients), Doctor (own patients only; Receptionist 403 for aggregate list)
  - **Response 200**: List of outstanding dues.

---

## Implementation Details

```
[ HTTP Request ] ──► [ ASP.NET Core Routing ]
                            │
                            ▼
               [ Auth & Role Middleware ] (FR-01, FR-02)
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      (Pass RBAC Check)           (Fail RBAC Check)
              │                           │
              ▼                           ▼
    [ Endpoint Controller ]          [ 403 Forbidden ]
              │
              ▼
   [ Application Service ]
              │
              ▼
   [ DB Query / Command ]
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=147-575) — API Shapes for FR-01 through FR-19
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Webhook signature verification notes

---

## Dependencies

- ASP.NET Core System.Text.Json serializer
- FluentValidation or Data Annotations for request DTO validation
- Azure Entra External ID JWT validation middleware

---

## Risks

- **Endpoint Leaks**: Exposing clinical note or financial reporting endpoints to Receptionist roles without server-side check.
- **Webhook Spoofing**: Trusting Razorpay webhook requests without validating HMAC signature against raw request payload.
- **Duplicate Payment Creation**: Omitting client idempotency keys on payment submissions.

---

## Future Improvements

- OpenAPI 3.0 (Swagger) spec generation for all v1 endpoints.
- Integration of rate-limiting middleware (5 login attempts / 10 mins) at Gateway level.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Specific ASP.NET Core API Gateway middleware library used for IP rate-limiting.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=147-575)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md)
