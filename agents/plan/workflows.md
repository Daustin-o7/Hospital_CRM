# SAMSTACK AI — Business & Technical Workflows (`plan/workflows.md`)

This document details the end-to-end operational and clinical workflows across SAMSTACK AI Phase 1 requirements (FR-01 through FR-22).

---

## Purpose

To define exact step-by-step business processes, user interactions, system state changes, edge case handling, and cross-cutting triggers for every Phase 1 workflow.

---

## Scope

Covers authentication, staff onboarding, clinic setup, patient registration, DPDP consent capture, appointment booking, queue management, consultation recording, prescription issuance, invoice generation, payment collection, WhatsApp notification dispatch, and offline synchronization.

---

## Verified Information

### 1. User Authentication & Session Workflow (FR-01, FR-02, FR-03)
1. **Login**: User submits email + password (`POST /api/v1/auth/login`).
2. **Identity Verification**: System validates credentials against Azure Entra External ID.
3. **Token Issuance**: Returns RS256-signed access token (15 min) + rotated refresh token.
4. **Session Monitoring**: Server enforces 30-minute inactivity timeout for Doctor and Clinic Admin roles.
5. **Password Reset**: User requests reset link via email (30 min token expiry). Reset revokes all existing refresh tokens.

### 2. Patient Onboarding & DPDP Consent Workflow (FR-06, FR-08, FR-09)
1. **Data Entry**: Receptionist enters name, phone number, and DOB or approximate age (max 3 required fields).
2. **Duplicate Check**: System executes phone index query before save. If duplicate exists, user is prompted.
3. **Consent Capture**: DPDP consent record is inserted within the **same database transaction** (`patient_consent` row).
4. **Audit Trail**: Any subsequent demographic edits trigger an append-only entry in `patient_audit_log`.

### 3. Appointment Booking & Queue Management Workflow (FR-10, FR-11, FR-12, FR-13)
1. **Slot Selection**: User selects patient, date, and time slot. System verifies slot against clinic working hours (`FR-05`).
2. **Conflict Prevention**: Database unique constraint `(doctor_id, date, time_slot)` where `status != cancelled` prevents race conditions.
3. **Event Dispatch**: Booking dispatches an asynchronous `AppointmentConfirmed` event (FR-20).
4. **Check-In & Queue**: On patient arrival, staff triggers check-in (`POST /api/v1/appointments/{id}/checkin`), assigning the next sequential daily token number.

### 4. Clinical Consultation & Prescription Workflow (FR-14, FR-15, FR-16)
1. **Consultation Entry**: Doctor opens checked-in appointment, inputs chief complaint, observations, and diagnosis.
2. **Prescription Linking**: Doctor adds free-text medicine items, dosage, frequency, and duration linked to the consultation.
3. **Immutability & Amendments**: Saved notes/prescriptions are never overwritten. Edits issue a new row with `previous_version_id` set.
4. **Timeline View**: Doctor pulls up complete chronological timeline (FR-16). Receptionist has zero access to clinical notes.

### 5. Billing & Payment Collection Workflow (FR-17, FR-18, FR-19)
1. **Invoice Generation**: System generates sequential gapless invoice number per clinic, automatically computing GST.
2. **Payment Execution**:
   - **Cash**: Direct confirmation, invoice marked `paid` instantly.
   - **Razorpay**: API generates hosted payment order/link. Server waits for HMAC signature-verified webhook (`POST /api/v1/webhooks/razorpay`) or status reconciliation poll.
3. **Idempotency**: `idempotency_key` unique constraint prevents double-crediting duplicate webhooks.

### 6. WhatsApp Notification Dispatch Workflow (FR-20, FR-21)
1. **Trigger**: `AppointmentConfirmed` event fires asynchronously.
2. **Handler Processing**: Handler builds WhatsApp payload and dispatches via `INotificationChannel`.
3. **Failure Isolation**: WhatsApp API error retries up to 3 times with exponential backoff, logging failure in `notification_log`. **Appointment booking is never rolled back**.

### 7. Offline Sync Workflow (FR-22)
1. **Network Interruption**: Network call fails during registration (FR-06) or invoicing (FR-17/18).
2. **Client Storage**: Client queues request object into IndexedDB with client-generated UUID `idempotencyKey`.
3. **Auto-Reconnect**: Service Worker detects network restore and sends queued payloads.
4. **Server Deduplication**: Server checks `idempotency_key` column; repeated keys return the original response without duplicate row creation.

---

## Implementation Details

```
[ Front Desk User ]
       │
       ├─► (Offline) ─► Store in IndexedDB (Client IdempotencyKey)
       │                       │
       │                       └─► On Reconnect ─► POST /api/v1/invoices
       │                                                   │
       └─► (Online) ───────────────────────────────────────┤
                                                           ▼
                                                [ API Gateway / Middleware ]
                                                           │ (RBAC Check)
                                                           ▼
                                                [ Application Service ]
                                                           │
                                           ┌───────────────┴───────────────┐
                                           ▼                               ▼
                                  [ DB Transaction ]           [ Async Event Bus ]
                              (Gapless Invoice Number)                  │
                                           │                            ▼
                                           ▼                  [ WhatsApp Handler ]
                                 [ Append Audit Log ]                   │
                                                                        ▼
                                                              [ Meta / BSP API ]
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=123-640) — Detailed Functional Requirements (FR-01 to FR-22)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md) — Integration patterns reference

---

## Dependencies

- Azure Entra External ID OIDC
- PostgreSQL transaction engine & unique index constraints
- Razorpay Webhook REST API
- WhatsApp Business API (BSP or Meta Direct)
- Browser IndexedDB API

---

## Risks

- **Webhook Signature Tampering**: Failing to verify Razorpay webhook signature header before marking invoice paid.
- **Race Condition Double Booking**: Checking slot availability in application code without database unique constraints.
- **Offline Data Loss**: Storing pending offline queues in browser `localStorage` instead of `IndexedDB`.

---

## Future Improvements

- Automated background reconciliation job polling Razorpay API for missing webhooks after 15 minutes.
- Support for emergency queue token reordering (MOD-24 Fast-Follow).

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Exact cron schedule timing for FR-21 daily appointment reminder batch job.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=123-640)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md)
