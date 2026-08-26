# Engineering Skill: SQL & Database Standards (`skills/sql.md`)

This document defines SQL writing standards, schema migration rules, database indexing policies, append-only security role configurations, and multi-tenancy column rules for PostgreSQL in SAMSTACK AI.

---

## Purpose

To guide AI assistants and developers on writing secure, maintainable, performant PostgreSQL DDL/DML scripts and Entity Framework migrations.

---

## Scope

Applies to all EF Core migrations, raw SQL scripts, PostgreSQL table definitions, indexes, database role permission scripts, and query optimizations.

---

## Verified Information

- **Database System**: PostgreSQL 16+
- **Tenancy Column Requirement**: Every tenant-scoped table MUST include `tenant_id uuid NOT NULL`.
- **Database Role Enforcement**: Audit log tables (`patient_audit_log`, `patient_consent`) MUST have UPDATE and DELETE permissions revoked for the application's DB role (`REVOKE UPDATE, DELETE`).
- **Primary Key Standard**: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- **Timestamp Standard**: `timestamptz NOT NULL DEFAULT clock_timestamp()`.

---

## Implementation Details

### 1. Database Role Append-Only Script
Every production and test environment setup MUST execute database role restrictions for audit immutability:

```sql
-- Enforce audit log immutability at DB role level (FR-08, FR-09)
GRANT SELECT, INSERT ON TABLE patient_audit_log TO samstack_app_user;
REVOKE UPDATE, DELETE ON TABLE patient_audit_log FROM samstack_app_user;

GRANT SELECT, INSERT ON TABLE patient_consent TO samstack_app_user;
REVOKE UPDATE, DELETE ON TABLE patient_consent FROM samstack_app_user;
```

### 2. Migration Guidelines & Checklist
- **Never Modify Committed Migrations**: Once an EF Core migration file is committed, do not edit it. Generate a new migration for modifications.
- **Always Include `tenant_id`**: Verify that new entities generated in C# include the `TenantId` property so the resulting migration creates `tenant_id uuid NOT NULL`.
- **Unique Indexes for Business Rules**:
  - `appointments`: `CREATE UNIQUE INDEX uq_doctor_slot ON appointments(doctor_id, date, time_slot) WHERE status != 'cancelled';`
  - `invoices`: `CREATE UNIQUE INDEX uq_invoice_number ON invoices(invoice_number);`
  - `payments`: `CREATE UNIQUE INDEX uq_payments_idempotency ON payments(idempotency_key);`

### 3. Query Indexing Strategy
- Search by phone number (FR-07): `CREATE INDEX idx_patients_phone ON patients(phone);`
- Trigram search by patient name: `CREATE INDEX idx_patients_name_trgm ON patients USING gin (name gin_trgm_ops);`
- Daily schedule lookup (FR-11): `CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, date);`

---

## Important Files

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md#line=160-636) — DB Schema Notes
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md#line=30-32) — Audit Trail & Role Enforcement

---

## Dependencies

- PostgreSQL 16+ server instance
- `pg_trgm` PostgreSQL extension for partial name matching

---

## Risks

- **Bypassing DB Role Security**: Running application migrations using a superuser DB credentials instead of restricted `samstack_app_user` role.
- **Migration Drift**: Manually editing local database tables without creating matching EF Core migrations.
- **Race Condition Double Booking**: Omitting partial unique index on active appointment slots.

---

## Future Improvements

- Automated migration validation script in CI pipeline flagging missing `tenant_id` columns.

---

## Unknown Information

> UNKNOWN — Requires human confirmation: Production database hosting provider configuration for automated point-in-time backups.

---

## Last Verified Date

2026-08-26

---

## Verification Source

- [`samstack-ai-frd-phase1-FINAL.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-ai-frd-phase1-FINAL.md)
- [`samstack-implementation-reference.md`](file:///e:/Company/Hospital%20Management/Hospital_CRM/samstack-implementation-reference.md)
