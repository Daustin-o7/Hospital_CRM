# SAMSTACK AI — Database Architecture & Schemas (`plan/database.md`)

This document defines the relational database architecture, Entity Framework mappings, table schemas, columns, constraints, indexing strategies, append-only audit enforcement, and dormant multi-tenant design for SAMSTACK AI.

---

## Purpose

To provide a complete database schema reference for PostgreSQL, ensuring data integrity, strict auditability, index optimization, and zero-migration forward-compatibility for multi-tenancy.

---

## Scope

Covers PostgreSQL 16+ schemas for Phase 1 tables (MOD-01 through MOD-07 + Cross-Cutting capabilities), database role permissions, indexing policies, and data retention rules.

---

## Verified Information

- **Database Engine**: PostgreSQL 16+
- **ORM / Data Access**: Entity Framework Core / Npgsql
- **Tenancy Column Rule**: Every tenant-scoped table MUST include `tenant_id uuid NOT NULL` (dormant in single-tenant Phase 1).
- **Audit Immutability**: Immutability enforced at the database role level: `REVOKE UPDATE, DELETE ON patient_audit_log, patient_consent, consultations, prescriptions FROM samstack_app_user;`.
- **Soft Delete Policy**: Clinical records (consultations, prescriptions, invoices) are NEVER deleted. Cancellations and amendments issue new version rows or status flags.

---

## Implementation Details

### Table Schemas & Constraints

#### 1. `users` (FR-01, FR-02, FR-04)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- Dormant in Phase 1
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'clinic_admin', 'doctor', 'receptionist'
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_users_email ON users(email);
```

#### 2. `refresh_tokens` (FR-01)
```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

#### 3. `staff_invites` (FR-04)
```sql
CREATE TABLE staff_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ NULL
);
```

#### 4. `clinics`, `clinic_hours`, `clinic_holidays` (FR-05)
```sql
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE clinic_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    day_of_week VARCHAR(20) NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL
);

CREATE TABLE clinic_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    holiday_date DATE NOT NULL
);
```

#### 5. `patients`, `patient_consent`, `patient_audit_log` (FR-06, FR-08, FR-09, FR-22)
```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    dob DATE NULL,
    approx_age INT NULL,
    gender VARCHAR(20) NOT NULL,
    address TEXT NULL,
    idempotency_key UUID UNIQUE NULL, -- FR-22 Offline Sync
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_name_trgm ON patients USING gin (name gin_trgm_ops);

CREATE TABLE patient_consent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    purpose VARCHAR(255) NOT NULL,
    captured_by UUID NOT NULL REFERENCES users(id),
    guardian_name VARCHAR(255) NULL,
    guardian_relationship VARCHAR(100) NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    withdrawn_at TIMESTAMPTZ NULL
);

CREATE TABLE patient_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    changed_by UUID NOT NULL REFERENCES users(id),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

#### 6. `appointments`, `appointment_history` (FR-10, FR-11, FR-12, FR-13)
```sql
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    time_slot TIME NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'scheduled', 'walkin'
    status VARCHAR(50) NOT NULL, -- 'booked', 'checked_in', 'completed', 'cancelled', 'no_show'
    queue_token INT NULL, -- Assigned at check-in (FR-12)
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, date, time_slot)
);
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, date);

CREATE TABLE appointment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id),
    previous_date DATE NOT NULL,
    previous_time TIME NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

#### 7. `consultations`, `prescriptions`, `prescription_items` (FR-14, FR-15, FR-16)
```sql
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    chief_complaint TEXT NOT NULL,
    observations TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    previous_version_id UUID NULL REFERENCES consultations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    medicine_text VARCHAR(255) NOT NULL,
    dosage_text VARCHAR(100) NOT NULL,
    frequency_text VARCHAR(100) NOT NULL,
    duration_text VARCHAR(100) NOT NULL
);
```

#### 8. `invoices`, `payments` (FR-17, FR-18, FR-19, FR-22)
```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    appointment_id UUID NOT NULL REFERENCES appointments(id),
    invoice_number VARCHAR(100) UNIQUE NOT NULL, -- Gapless per clinic
    subtotal NUMERIC(12,2) NOT NULL,
    gst_amount NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'unpaid', 'paid', 'partial'
    idempotency_key UUID UNIQUE NULL, -- FR-22 Offline Sync
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_invoices_status_date ON invoices(status, created_at);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    method VARCHAR(50) NOT NULL, -- 'cash', 'razorpay'
    amount NUMERIC(12,2) NOT NULL,
    razorpay_payment_id VARCHAR(255) NULL,
    status VARCHAR(50) NOT NULL, -- 'pending', 'paid', 'failed'
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

#### 9. `notification_log` (FR-20, FR-21)
```sql
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id),
    channel VARCHAR(50) NOT NULL, -- 'whatsapp'
    template VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'failed'
    sent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    delivered_at TIMESTAMPTZ NULL,
    failed_reason TEXT NULL
);
```

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=160-636) — Database Schema Notes for FR-01 through FR-22
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md#line=30-32) — DB Role Append-Only enforcement rules

---

## Dependencies

- PostgreSQL 16+ engine & pg_trgm extension for trigram search on `patients.name`
- Npgsql EF Core provider

---

## Risks

- **Audit Bypass**: Allowing DB user credentials to retain UPDATE/DELETE privileges on audit tables.
- **Race Condition double booking**: Removing unique constraint `uq_doctor_slot` from `appointments`.
- **Gapless Invoice Violation**: Deleting invoice rows instead of issuing credit notes.

---

## Future Improvements

- Automated table partitioning on `patient_audit_log` and `notification_log` by year.
- Legal verification of provisional 7-year medical data retention policy before baking cleanup crons into database scripts.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Legal confirmation of Indian medical record retention period (provisional 7 years in template vs DPDP data minimization).

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=160-636)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md)
