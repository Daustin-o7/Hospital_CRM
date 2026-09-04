# Hospital CRM — Complete Workflow (Phase 1 + Phase 2)

> Single source of truth for what the system does, end-to-end. Covers every FR from FR-01 through FR-14-XX.

---

## System Overview

```
Hospital CRM (Samstack AI)
├── Phase 1: FR-01 → FR-22 (core CRM + billing) — SHIPPED
└── Phase 2: FR-23 → FR-14 (9 Fast-Follow modules) — SHIPPED 100%
    ├── MOD-23 Pre-Check Form
    ├── MOD-24 Emergency Queue
    ├── MOD-25 Live Ticket Tracking
    ├── MOD-12 Speciality EMR Templates
    ├── MOD-13 Notification Rules Engine (absorbs FR-20/21)
    ├── MOD-09 Inventory
    ├── MOD-10 Wishlist
    ├── MOD-08 Lab Records
    ├── MOD-11 Finance Ledger
    └── MOD-14 Platform Admin Portal
```

**Stack:** .NET 10 (Minimal APIs, EF Core 10) · React 19 PWA · PostgreSQL 16 · Azure Entra External ID · Razorpay · WhatsApp Business API

---

## Phase 1 Workflow (FR-01 to FR-22)

### 1.1 — Identity & Access

```
┌──────────────────────────────────────────────────────────────┐
│ FR-01: User Login                                            │
└──────────────────────────────────────────────────────────────┘
  POST /api/v1/auth/login { email, password }
       │
       ▼
  BCrypt verify ──► Generate JWT (RS256)
       │              ├─ kid from persistent key (PemFileKeyService
       │              │   for dev, AzureKeyVaultKeyService for prod
       │              │   — ADR-07)
       │              ├─ 15-min access token
       │              └─ 30-day refresh token (rotated)
       ▼
  InactivityMiddleware (30-min sliding window for Doctor/Admin,
  in-memory cache, 2-min TTL)
       │
       ▼
  GET /api/v1/auth/.well-known/jwks.json
       └─► Exposes public key for downstream verification

┌──────────────────────────────────────────────────────────────┐
│ FR-02: Role Enforcement (server-side)                       │
└──────────────────────────────────────────────────────────────┘
  [AuthorizeRoles("Doctor", "ClinicAdmin", "Receptionist")]
       │
       ▼
  RbacHandler ──► reads "role" claim from JWT
       │
       ▼
  [Authorize] short-circuit on mismatch

┌──────────────────────────────────────────────────────────────┐
│ FR-03: Password Reset                                        │
└──────────────────────────────────────────────────────────────┘
  POST /api/v1/auth/request-password-reset { email }
       └─► EmailPasswordResetToken (30-min expiry)
  POST /api/v1/auth/confirm-password-reset { token, newPassword }
       └─► Revokes all existing sessions for that user

┌──────────────────────────────────────────────────────────────┐
│ FR-04: Staff Invitation                                      │
└──────────────────────────────────────────────────────────────┘
  Clinic Admin ──► POST /api/v1/staff/invite { name, email, role }
       └─► StaffInvite row (72h expiry, single-use)
  Invitee ──► POST /api/v1/staff/accept-invite { token, password }
       └─► User row created with assigned role
```

### 1.2 — Clinic Configuration

```
┌──────────────────────────────────────────────────────────────┐
│ FR-05: Clinic Profile Setup                                  │
└──────────────────────────────────────────────────────────────┘
  GET /api/v1/clinic/profile ──► name, hours, holidays, special hours,
                                  GST rate, token format, branding, etc.
  PUT /api/v1/clinic/profile ──► update 30+ configurable fields
  PUT /api/v1/clinic/hours ──► per-day open/close (all 7 days)
  POST /api/v1/clinic/holidays ──► exact dates or recurring annual
  DELETE /api/v1/clinic/holidays/{id}
  POST /api/v1/clinic/special-hours ──► date-specific overrides
  DELETE /api/v1/clinic/special-hours/{id}
       │
       ▼
  Booking validates: holiday → special hours → weekly schedule
  (precedence: most-specific wins)
```

### 1.3 — Patient Module

```
┌──────────────────────────────────────────────────────────────┐
│ FR-06: Register Patient                                      │
└──────────────────────────────────────────────────────────────┘
  POST /api/v1/patients { name, phone, dob|approxAge, gender,
                            address, consent: { accepted, purpose },
                            idempotencyKey? }
       │
       ├─► Phone duplicate check (returns existing patient)
       ├─► Idempotency-key replay protection
       └─► Creates: Patient row + PatientConsent row (same transaction)

┌──────────────────────────────────────────────────────────────┐
│ FR-07: Search / View Patient                                 │
└──────────────────────────────────────────────────────────────┘
  GET /api/v1/patients/search?q=<min 3 chars>
       └─► Phone starts-with + name contains (50 max, B-Tree index)
  GET /api/v1/patients/{id} ──► demographics + consents
  PATCH /api/v1/patients/{id} ──► update demographics

┌──────────────────────────────────────────────────────────────┐
│ FR-08: Edit Patient (append-only audit)                      │
└──────────────────────────────────────────────────────────────┘
  PATCH triggers PatientAuditLog row (never UPDATE/DELETE —
  enforced at DB role level: REVOKE UPDATE,DELETE on
  PatientAuditLogs FROM app_user)

┌──────────────────────────────────────────────────────────────┐
│ FR-09: DPDP Consent (inline with registration)               │
└──────────────────────────────────────────────────────────────┘
  Same transaction as FR-06. PatientConsent row records
  purpose, captured_by, captured_at.
```

### 1.4 — Appointments

```
┌──────────────────────────────────────────────────────────────┐
│ FR-10: Book Appointment                                      │
└──────────────────────────────────────────────────────────────┘
  POST /api/v1/appointments { patientId, doctorId, date, timeSlot,
                                type: "scheduled|walkin" }
       │
       ▼
  Serializable transaction:
  1. Slot already taken? ──► 409 conflict
  2. Outside working hours / holiday? ──► 400
  3. Create Appointment row (Status=Booked)
  4. [Phase 2: MOD-23] Generate pre-check token (if >2h lead time)
  5. Commit
  6. Fire async:
     - SendAppointmentConfirmationAsync (with precheckLink)
     - [Phase 2: MOD-13] rule evaluation
       │
       ▼
  Returns 201 { appointmentId, status: "booked", queueToken: null }

┌──────────────────────────────────────────────────────────────┐
│ FR-11: View Daily Schedule                                   │
└──────────────────────────────────────────────────────────────┘
  GET /api/v1/appointments?date=&doctorId=&status=
       └─► [Phase 2: MOD-24] Sort: emergency DESC, date ASC, time ASC
       └─► Polling refresh (HTTP, no WebSockets per TRD)

┌──────────────────────────────────────────────────────────────┐
│ FR-12: Generate Queue Token (on check-in)                    │
└──────────────────────────────────────────────────────────────┘
  POST /api/v1/appointments/{id}/check-in
       │
       ▼
  Max token for clinic+date ──► +1 ──► assign
  [Phase 2: MOD-25] Same token unlocks live status link
       │
       ▼
  Returns 200 { status: "checked_in", queueToken: N }

┌──────────────────────────────────────────────────────────────┐
│ FR-13: Reschedule / Cancel                                  │
└──────────────────────────────────────────────────────────────┘
  PUT /api/v1/appointments/{id} { date, timeSlot, status }
       └─► AppointmentHistory row appended for every change
```

### 1.5 — Clinical

```
┌──────────────────────────────────────────────────────────────┐
│ FR-14: Create Consultation (versioned amendments)            │
└──────────────────────────────────────────────────────────────┘
  POST /api/v1/appointments/{id}/consultation
       { chiefComplaint, observations, diagnosis, previousVersionId? }
       │
       ▼
  If previousVersionId set, version = prev.version + 1
  Otherwise version = 1
       │
       ▼
  POST /api/v1/consultations/{id}/amend ──► creates new Consultation
       with PreviousVersionId pointing to original
       (amendment, never silent overwrite)

┌──────────────────────────────────────────────────────────────┐
│ FR-15: Write Prescription                                    │
└──────────────────────────────────────────────────────────────┘
  POST /api/v1/consultations/{id}/prescriptions
       { items: [{ medicine, dosage, duration, frequency }] }
       └─► Prescriptions + PrescriptionItems linked to consultation

┌──────────────────────────────────────────────────────────────┐
│ FR-16: Treatment Timeline                                    │
└──────────────────────────────────────────────────────────────┘
  GET /api/v1/consultations?patientId=&dateFrom=&dateTo=
       └─► Chronological consultations + prescriptions per patient
```

### 1.6 — Billing

```
┌──────────────────────────────────────────────────────────────┐
│ FR-17: Generate Invoice                                      │
└──────────────────────────────────────────────────────────────┘
  POST /api/v1/invoices { appointmentId, lineItems: [...] }
       │
       ▼
  Serialized transaction:
  1. Next invoice number (gapless) — uses ExecutionStrategy
  2. GST = subtotal × DefaultGstRate
  3. Total = subtotal + GST
  4. Invoice row + InvoiceLineItem rows

┌──────────────────────────────────────────────────────────────┐
│ FR-18: Collect Payment                                       │
└──────────────────────────────────────────────────────────────┘
  POST /api/v1/invoices/{id}/payment
       { method: "cash|razorpay", amount }
       │
       ├─► Cash: marks Payment Completed + Invoice Paid immediately
       │
       └─► Razorpay:
           1. Create payment link (Razorpay SDK stub)
           2. Return { paymentLinkUrl, paymentId }
           3. Patient pays on Razorpay
           4. Webhook hits POST /api/v1/invoices/webhooks/razorpay
              - HMAC SHA256 verify X-Razorpay-Signature
                (constant-time compare)
              - Mark Payment Completed, Invoice Paid
           5. [Phase 1 carry-over] RazorpayReconciliationWorker
              polls pending payments every 60 min as safety net

┌──────────────────────────────────────────────────────────────┐
│ FR-19: View Outstanding Dues                                 │
└──────────────────────────────────────────────────────────────┘
  GET /api/v1/invoices?status=unpaid
       └─► Admin: all unpaid; Doctor: own patients only
```

### 1.7 — Notifications (Phase 1 → Phase 2 migration)

```
┌──────────────────────────────────────────────────────────────┐
│ FR-20/21 → MOD-13 defaults (see Phase 2 §A.3)               │
└──────────────────────────────────────────────────────────────┘
  Phase 1 path: booking flow fires SendAppointmentConfirmationAsync
  and ReminderSchedulerService (24h-before daily batch).
  Phase 2: these continue to work; Clinic Admin can configure
  additional rules via MOD-13.
```

### 1.8 — Offline Sync (Deferred)

```
┌──────────────────────────────────────────────────────────────┐
│ FR-22: Offline-Tolerant Sync                                 │
└──────────────────────────────────────────────────────────────┘
  STATUS: Not built. No IndexedDB queue in frontend yet.
  Server-side idempotency keys are in place (FR-06/17) — the
  client-side half is deferred per state/technical-debt.md item 7.
```

---

## Phase 2 Workflow (9 Modules)

### 2.A — Patient Pre-Visit

```
┌──────────────────────────────────────────────────────────────┐
│ MOD-23: Pre-Check Form (FR-23-01/02/03)                      │
└──────────────────────────────────────────────────────────────┘
  [FR-23-01] Booking transaction (FR-10) generates pre-check:
     - SHA256-hashed token (plaintext sent in WhatsApp, hash stored)
     - Skip if walk-in OR <2h lead time
     - Token expiry = appointment slot time
     - WhatsApp message: "...appointment confirmed. Pre-visit form: {link}"

  [FR-23-02] Patient clicks link (unauthenticated):
     POST /api/v1/precheck/{token}
     { chiefComplaint?, symptomDuration?, medications?, allergies? }
     └─► Updates PrecheckSubmission row (sets SubmittedAt)

  [FR-23-03] Doctor in consult screen:
     GET /api/v1/appointments/{id}/precheck
     └─► Returns all four fields inline (chiefComplaint/symptomDuration/
         medications/allergies) for review

  Edge case: correction = doctor edits in their own consultation
  notes (no second precheck submission). The form is one-shot per
  appointment.

┌──────────────────────────────────────────────────────────────┐
│ MOD-24: Emergency Queue (FR-24-01/02)                        │
└──────────────────────────────────────────────────────────────┘
  [FR-24-01] Receptionist/Doctor/ClinicAdmin:
     PATCH /api/v1/appointments/{id}/priority
     { priority: "emergency|normal" }
       │
       ▼
     - Updates Appointment.Priority
     - Inserts PriorityLog row (who, when, what)
     - Idempotent (no DB write if priority unchanged)

  [FR-24-02] GET /api/v1/appointments?date=... automatically
     OrderByDescending(Priority) → ThenBy(Date) → ThenBy(TimeSlot)
     (Emergency surfaces next without disturbing underlying slot times)

  Edge case: two emergencies flagged in sequence served in flag order,
  not re-litigated.

┌──────────────────────────────────────────────────────────────┐
│ MOD-25: Live Ticket Tracking (FR-25-01)                      │
└──────────────────────────────────────────────────────────────┘
  Receptionist checks in patient (FR-12) ──► queueToken assigned
       │
       ▼
  Link format: http://localhost:5173/queue/{token}
  (would be sent via WhatsApp in real impl, currently manual)
       │
       ▼
  Patient (unauthenticated):
     GET /api/v1/queue-status/{token}
     └─► { currentlyServing: int, yourToken: int }
     Filtered by doctor + date; excludes cancelled appointments
     Edge case: emergency-superseded patient sees honest new wait

  Refresh: client polls (e.g. 30s) — no WebSockets per TRD.
```

### 2.A.3 — Clinical Enhancements

```
┌──────────────────────────────────────────────────────────────┐
│ MOD-12: Speciality EMR Templates (FR-12-01/02)               │
└──────────────────────────────────────────────────────────────┘
  [FR-12-01] Doctor in consult screen:
     GET /api/v1/consult-templates?specialty=dental
     └─► Returns built-in (DoctorId=null) + their own customs
     Built-in seeded (per survey 25%/17%/17%):
       - dental: 8 sections (chief_complaint, dental_history, etc.)
       - general: 9 sections (hpi, pmh, examination, ...)
       - ayurveda: 9 sections (hetu, prakriti, vikriti, ...)

  Client renders form from structure JSON ──► Doctor edits per patient
  Maps section values to consultation request fields
  Templates pre-fill, NEVER auto-submit (FR-14's amendment principle)

  [FR-12-02] Doctor creates custom:
     POST /api/v1/consult-templates
     { specialty, name, structure: { sections: [...] } }
     └─► Doctor-scoped (other doctors in same clinic don't see it)

  Edge case: template deleted while draft in use ──► draft unaffected
  (templates are starting point, not live-linked)

┌──────────────────────────────────────────────────────────────┐
│ MOD-13: Notification Rules Engine (FR-13-01/02/03)            │
└──────────────────────────────────────────────────────────────┘
  [FR-13-02] Clinic Admin creates message templates:
     POST /api/v1/message-templates
     { name, channel: "whatsapp", content }
     └─► TemplateApprovalStatus=Pending (Meta/BSP approval external)

  [FR-13-01] Clinic Admin configures rules:
     POST /api/v1/notification-rules
     { ruleType: "remindndaysbefore|remindifnovisitnmonths|
                   appointmentconfirmation|appointmentreminder",
       timingConfig: { daysBefore: 1, months: 6 },
       templateId, active: true }
     PATCH /api/v1/notification-rules/{id} { active: false }

  [FR-13-03] NotificationRulesWorker (BackgroundService, 5-min):
     1. Read active rules for current tenant
     2. For each rule:
        a. Parse timingConfig
        b. Query matching appointments/patients
        c. For each candidate:
           - Check NotificationLog for (RuleId, AppointmentId, same-day)
             → skip if already sent (idempotency)
           - Render template with {{patient_name}}/{{clinic_name}}/{{date}}/{{time}}
           - Insert NotificationLog row (RuleId set, Channel, SentAt)
           - Log to console (stub; real impl calls Meta/BSP)
     3. Per-rule exception isolation (one bad rule doesn't crash worker)

  Phase 1 FR-20/21 become default rules:
    - appointmentconfirmation: wired into booking flow
    - appointmentreminder: 1 day before, fired by worker
    (Phase 1 ReminderSchedulerService continues to work as backup)

  Edge case: rule conflicts (two rules would fire same day) →
  de-duplicated at send time (one message, not two).
```

### 2.A.4 — Operational Data

```
┌──────────────────────────────────────────────────────────────┐
│ MOD-09: Inventory (FR-09-01/02/03)                           │
└──────────────────────────────────────────────────────────────┘
  [FR-09-01] Clinic Admin/Receptionist:
     POST /api/v1/inventory/items
     { name, tier: "dead|consumable|usable", unit, lowStockThreshold? }
     PATCH /api/v1/inventory/items/{id} { name?, unit?, active?, threshold? }
       └─► Soft-deactivate (active=false), NEVER hard delete
           (historical stock_movements must still reference item by ID)

  [FR-09-02] Staff logs in/out:
     POST /api/v1/inventory/items/{id}/movements
     { quantity: int>0, direction: "in|out", note? }
       │
       ▼
     - Inserts StockMovement row (append-only)
     - Returns { balanceBefore, balanceAfter, wouldGoNegative, warning }
     - Edge case: movement would take balance negative → WARN, don't block
       (physical stock corrections happen; a hard block would just
       get staff to enter fake numbers to get past it)

     GET /api/v1/inventory/items/{id}/movements ──► audit history

  [FR-09-03] Clinic Admin:
     GET /api/v1/inventory/low-stock ──► items where balance ≤ threshold

  Tiers flagged for pilot validation per FRD: confirm 3-way split
  matches how clinics actually think about stock.

┌──────────────────────────────────────────────────────────────┐
│ MOD-10: Wishlist (FR-10-01)                                  │
└──────────────────────────────────────────────────────────────┘
  Doctor/ClinicAdmin:
     POST /api/v1/wishlist-items { text, category: "task|goal|equipment|expansion" }
     GET /api/v1/wishlist-items?status=open|done|cancelled
     PATCH /api/v1/wishlist-items/{id} { text?, category?, status? }
       │
       ▼
  Deliberately minimal: NO reminders, NO due dates, NO staff
  assignment (ponytail discipline: this is a note-taking list,
  not a project-management tool).

┌──────────────────────────────────────────────────────────────┐
│ MOD-08: Lab Records (FR-08-01/02/03)                         │
└──────────────────────────────────────────────────────────────┘
  [FR-08-01] Doctor orders:
     POST /api/v1/consultations/{id}/lab-orders
     { testName, notes? }
       └─► Status=Ordered; links to consultation, denormalizes
           patientId+doctorId for fast worklist

  [FR-08-02] Doctor/ClinicAdmin enters result:
     PATCH /api/v1/lab-orders/{id}/result
     (multipart: resultText?, file?)
       │
       ▼
     - Creates new LabResult row with Version = latest+1
     - PreviousVersionId chain (amendment, never overwrite)
     - File saved to lab-uploads/ (local disk; S3 swap per TRD-Phase2)
     - FileUrl returned: /lab-uploads/{file}
     - Order status → Completed

  [FR-08-03] Doctor/ClinicAdmin views:
     GET /api/v1/lab-orders?status=ordered|completed
       └─► Sort: pending first, then by createdAt desc
       └─► Each row shows latestResultVersion

  Edge case: consultation amended after order created ──► order
  still links to original consultation ID, unaffected.
  No LIMS/instrument auto-import (per FR-08-02 security notes).

┌──────────────────────────────────────────────────────────────┐
│ MOD-11: Finance Ledger (FR-11-01/02/03)                      │
└──────────────────────────────────────────────────────────────┘
  [FR-11-01] Clinic Admin:
     GET /api/v1/ledger/income?month=YYYY-MM
       └─► Sums completed payments in that month
       └─► NO separate income table — always reconciles to payments
           (FR-11-01 acceptance: divergence is a bug, not variance)

  [FR-11-02] Clinic Admin:
     POST /api/v1/ledger/expenses
     { category: "rent|utilities|salaries|supplies|equipment|
                  marketing|professionalservices|insurance|taxes|other",
       categoryOther?: string,
       amount: decimal>0,
       expenseDate: YYYY-MM-DD,
       note? }
       └─► 10 fixed categories per FR-11-02 (NOT full chart-of-accounts)

     PATCH /api/v1/ledger/expenses/{id}
       └─► Edit sets EditedAt timestamp (audit trail per FR-11-02 edge case)

     GET /api/v1/ledger/expenses?month=YYYY-MM

  [FR-11-03] Clinic Admin:
     GET /api/v1/ledger/summary?month=YYYY-MM&format=json
       └─► Returns:
         { month, income, expenses: { total, byCategory: [...] }, net,
           exportFormat: "json" }
       └─► format= CSV/PDF EXPLICITLY DEFERRED (FR-11-03 acceptance:
           "the actual export format pilot clinics' accountants want"
           needs a real answer before this FR is fully specified)

┌──────────────────────────────────────────────────────────────┐
│ MOD-14: Platform Admin Portal (FR-14-01/02/03/04)            │
└──────────────────────────────────────────────────────────────┘
  GATED on Tier 2 tenancy activation (per FRD §11).
  Endpoints built + tested today, functionally idle until second
  tenant signs up. Seeded user: platform-admin@samstack.ai.

  [FR-14-01] SAMSTACK staff (PlatformAdmin role):
     GET /api/v1/platform-admin/tenants?q=search
       └─► Lists all clinics (single-tenant now, multi-tenant in Tier 2)
       └─► Shows: name, subscriptionTier, status, activatedModules

  [FR-14-02] SAMSTACK staff:
     GET /api/v1/platform-admin/tenants/{id}
     PATCH /api/v1/platform-admin/tenants/{id}
     { subscriptionTier?, subscriptionStatus?, activatedModules?,
       subscriptionEndsAt? }
       └─► Every change is highest-privilege audit-tracked
           (same standard as financial mutations)

  [FR-14-03] SAMSTACK staff (the single highest-risk feature):
     POST /api/v1/platform-admin/impersonate
     { tenantId, userId, reason? }
       │
       ▼
     - Inserts ImpersonationLog row (startedAt, reason, who impersonated)
     - Returns warning: "impersonation_active_session_logged"
     - In real impl: mints short-lived token for target user with
       impersonatedBy claim. Out of scope for Phase 1 cut.

     POST /api/v1/platform-admin/impersonate/{id}/end ──► sets endedAt
     GET  /api/v1/platform-admin/impersonations?tenantId= ──► full audit

     FR-14-03 acceptance: impersonation doesn't grant extra privilege
     (impersonated session can only do what the impersonated user's
     own role could).

  [FR-14-04] SAMSTACK staff:
     GET  /api/v1/platform-admin/tenants/{id}/flags
     PATCH /api/v1/platform-admin/tenants/{id}/flags/{flagName}
     { enabled: bool }
       └─► Minimal flag infra (TRD_Phase1 §10 explicitly deferred general
           flags; this is the first real justification, minimal version)

  Security: [AuthorizeRoles("PlatformAdmin")] on controller +
  defense-in-depth IsPlatformAdmin() check.
  Clinic admin gets 403 on all endpoints (boundary tested).
```

---

## End-to-End Patient Journey

```
DAY 1: First Visit
─────────────────────────────────────────────────────────────
[Reception]
  1. Receptionist registers patient (FR-06/09)
     POST /patients { name, phone, dob, consent }
  2. Schedules appointment (FR-10)
     POST /appointments { patientId, doctorId, date, timeSlot }
       └─► Auto: pre-check token + WhatsApp confirmation
  3. Patient receives WhatsApp with pre-check link (MOD-23)
     Patient opens link on phone, fills form
     POST /precheck/{token} { chiefComplaint, ... }
  4. Day of visit: patient arrives, checked in (FR-12)
     POST /appointments/{id}/check-in ──► queueToken
  5. Patient opens live tracking link (MOD-25)
     GET /queue-status/{token} ──► see wait

[Consultation]
  6. Doctor opens consult screen
     GET /appointments/{id}/precheck (MOD-23 FR-23-03)
     GET /consult-templates?specialty= (MOD-12 FR-12-01)
  7. Doctor creates consultation (FR-14)
     POST /appointments/{id}/consultation { chiefComplaint, ... }
  8. Doctor orders lab if needed (MOD-08 FR-08-01)
     POST /consultations/{id}/lab-orders { testName }

[Billing]
  9. Receptionist generates invoice (FR-17)
     POST /invoices { appointmentId, lineItems }
  10. Patient pays (FR-18)
      POST /invoices/{id}/payment { method: "cash" } (or Razorpay link)
      Razorpay webhook arrives ──► marks Paid

DAY 2-N: Follow-up
─────────────────────────────────────────────────────────────
  - Patient gets WhatsApp reminder (FR-21 → MOD-13 default rule, 1 day before)
  - Doctor amends consultation if needed (FR-14 amendment, never overwrite)
  - Lab result arrives (MOD-08 FR-08-02)
    PATCH /lab-orders/{id}/result { resultText, file }
  - Doctor writes prescription (FR-15)
    POST /consultations/{id}/prescriptions { items }

OPERATIONS (parallel to clinical)
─────────────────────────────────────────────────────────────
  - Receptionist flags walk-in as emergency (MOD-24 FR-24-01)
    PATCH /appointments/{id}/priority { priority: "emergency" }
  - Clinic Admin reviews low stock (MOD-09 FR-09-03)
    GET /inventory/low-stock
  - Clinic Admin reviews monthly ledger (MOD-11 FR-11-03)
    GET /ledger/summary?month=YYYY-MM
  - Doctor notes equipment wish (MOD-10)
    POST /wishlist-items { text, category: "equipment" }
```

---

## Endpoint Map (Complete)

```
AUTH & USERS
  POST   /api/v1/auth/login
  POST   /api/v1/auth/refresh
  GET    /api/v1/auth/.well-known/jwks.json
  POST   /api/v1/auth/request-password-reset
  POST   /api/v1/auth/confirm-password-reset
  POST   /api/v1/staff/invite
  POST   /api/v1/staff/accept-invite
  GET    /api/v1/staff

CLINIC
  GET    /api/v1/clinic/profile
  PUT    /api/v1/clinic/profile
  PUT    /api/v1/clinic/hours
  POST   /api/v1/clinic/holidays
  DELETE /api/v1/clinic/holidays/{id}
  POST   /api/v1/clinic/special-hours
  DELETE /api/v1/clinic/special-hours/{id}

PATIENTS
  POST   /api/v1/patients
  GET    /api/v1/patients/search?q=
  GET    /api/v1/patients/{id}
  PATCH  /api/v1/patients/{id}

APPOINTMENTS
  POST   /api/v1/appointments
  GET    /api/v1/appointments?date=&doctorId=&status=
  POST   /api/v1/appointments/{id}/check-in
  PUT    /api/v1/appointments/{id}
  PATCH  /api/v1/appointments/{id}/priority         (MOD-24)

CLINICAL
  POST   /api/v1/appointments/{id}/consultation
  POST   /api/v1/consultations/{id}/amend
  POST   /api/v1/consultations/{id}/prescriptions
  POST   /api/v1/consultations/{id}/lab-orders      (MOD-08)
  PATCH  /api/v1/lab-orders/{id}/result              (MOD-08)
  GET    /api/v1/lab-orders?status=                  (MOD-08)

BILLING
  POST   /api/v1/invoices
  POST   /api/v1/invoices/{id}/payment
  POST   /api/v1/invoices/webhooks/razorpay
  GET    /api/v1/invoices?status=

PRE-CHECK
  POST   /api/v1/precheck/{token}                    (MOD-23)
  GET    /api/v1/appointments/{id}/precheck           (MOD-23)

QUEUE
  GET    /api/v1/queue-status/{token}                 (MOD-25)

CONSULT TEMPLATES
  GET    /api/v1/consult-templates?specialty=         (MOD-12)
  POST   /api/v1/consult-templates                    (MOD-12)

NOTIFICATION RULES
  GET    /api/v1/notification-rules                   (MOD-13)
  POST   /api/v1/notification-rules                   (MOD-13)
  PATCH  /api/v1/notification-rules/{id}              (MOD-13)
  GET    /api/v1/message-templates                    (MOD-13)
  POST   /api/v1/message-templates                    (MOD-13)

INVENTORY
  GET    /api/v1/inventory/items                      (MOD-09)
  POST   /api/v1/inventory/items                      (MOD-09)
  PATCH  /api/v1/inventory/items/{id}                 (MOD-09)
  POST   /api/v1/inventory/items/{id}/movements       (MOD-09)
  GET    /api/v1/inventory/items/{id}/movements       (MOD-09)
  GET    /api/v1/inventory/low-stock                  (MOD-09)

WISHLIST
  GET    /api/v1/wishlist-items?status=               (MOD-10)
  POST   /api/v1/wishlist-items                       (MOD-10)
  PATCH  /api/v1/wishlist-items/{id}                  (MOD-10)

LEDGER
  GET    /api/v1/ledger/income?month=                 (MOD-11)
  POST   /api/v1/ledger/expenses                      (MOD-11)
  PATCH  /api/v1/ledger/expenses/{id}                 (MOD-11)
  GET    /api/v1/ledger/expenses?month=               (MOD-11)
  GET    /api/v1/ledger/summary?month=                (MOD-11)

PLATFORM ADMIN
  GET    /api/v1/platform-admin/tenants               (MOD-14)
  GET    /api/v1/platform-admin/tenants/{id}          (MOD-14)
  PATCH  /api/v1/platform-admin/tenants/{id}          (MOD-14)
  POST   /api/v1/platform-admin/impersonate           (MOD-14)
  POST   /api/v1/platform-admin/impersonate/{id}/end  (MOD-14)
  GET    /api/v1/platform-admin/impersonations        (MOD-14)
  GET    /api/v1/platform-admin/tenants/{id}/flags    (MOD-14)
  PATCH  /api/v1/platform-admin/tenants/{id}/flags/{flagName}  (MOD-14)
```

---

## State & Background Workers

| Worker | Interval | Purpose |
|---|---|---|
| `ReminderSchedulerService` (Phase 1) | 1 hour | FR-21 daily batch — sends 24h-before reminders (now also covered by MOD-13 `appointmentreminder` rule) |
| `RazorpayReconciliationWorker` | 60 min | FR-18 safety net — polls pending Razorpay payments, marks Paid if webhook missed |
| `NotificationRulesWorker` (Phase 2) | 5 min | MOD-13 — evaluates all active rules, fires via INotificationService with idempotency check |

---

## Security Boundaries (Verified)

- **Clinic scope**: All Phase 1 endpoints are tenant-scoped (`tenant_id = Guid.Empty` in Phase 1; dormant)
- **Role enforcement**: `[AuthorizeRoles]` + `RbacHandler` reads `"role"` claim
- **Audit append-only**: DB role `app_user` has `REVOKE UPDATE, DELETE` on `PatientAuditLogs`, `NotificationLogs`
- **Inactivity**: 30-min sliding window for Doctor/Admin, in-memory cache
- **Webhook HMAC**: Constant-time compare for `X-Razorpay-Signature`
- **Platform Admin boundary**: `[AuthorizeRoles("PlatformAdmin")]` + defense-in-depth `IsPlatformAdmin()` check. Clinic admin → 403 (verified)

---

## Out of Scope (Explicit)

- **Pharmacy** (MOD-15/16/17) — Track 2
- **AI features** (MOD-18/19) — Track 3
- **IPD** (MOD-20–26) — Track 4
- **UAE adapter** — International
- **Voice Agent** (MOD-27) — Phase 3 per FRD-Phase2 §9
- **Offline sync** (FR-22) — deferred (see state/technical-debt.md item 7)
- **Real WhatsApp / Razorpay / Entra** — stubs, awaiting pilot vendor accounts
- **S3 blob storage** for MOD-08 — local disk `lab-uploads/` for now

---

## References

- `FRD-Phase-2-FINAL.md` — Phase 2 master spec (all 9 modules)
- `TRD-Phase2-V1.md` — Phase 2 technical reference (Hangfire, blob storage)
- `PRD-Phase2-V1.md` — Phase 2 product reference (patient journey stories)
- `samstack-ai-frd-phase1-FINAL.md` — Phase 1 master spec (FR-01–22)
- `memory.md` — Session working memory
- `agents/state/*.md` — Project state files
