-- =============================================================================
-- setup-least-privilege-db.sql
-- Hospital_CRM Database Security Hardening Script
-- Implements Task 0.2: Enforce Database-Level Least Privilege (app_user)
-- =============================================================================

-- 1. Create app_user role if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD 'ChangeMeInProduction!';
    END IF;
END $$;

-- 2. Grant schema usage and connect privileges
GRANT CONNECT ON DATABASE hospital_crm TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- 3. Grant basic CRUD on all application tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 4. Automatically apply to future tables created in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- 5. Strict Append-Only Enforcement on Audit Tables (REVOKE UPDATE & DELETE)
-- App user can insert new audit records and select for querying, but can NEVER update or delete.
REVOKE UPDATE, DELETE ON TABLE "PatientAuditLogs" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "NurseAuditLogs" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "NotificationLogs" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "PriorityLogs" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "ImpersonationLogs" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "AppointmentHistories" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "ControlledSubstanceRegisters" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "AuthAuditLogs" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "DrugStockMovements" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "MedicineSearchMissLogs" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "PrescriptionPrintLogs" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "FinanceLedgerEntries" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "InvoicePrintLogs" FROM app_user;
REVOKE UPDATE, DELETE ON TABLE "CreditNotes" FROM app_user;

GRANT INSERT, SELECT ON TABLE "PatientAuditLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "NurseAuditLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "NotificationLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "PriorityLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "ImpersonationLogs" TO app_user;
GRANT UPDATE ("EndedAt") ON TABLE "ImpersonationLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "AppointmentHistories" TO app_user;
GRANT INSERT, SELECT ON TABLE "ControlledSubstanceRegisters" TO app_user;
GRANT INSERT, SELECT ON TABLE "AuthAuditLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "DrugStockMovements" TO app_user;
GRANT INSERT, SELECT ON TABLE "MedicineSearchMissLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "PrescriptionPrintLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "FinanceLedgerEntries" TO app_user;
GRANT INSERT, SELECT ON TABLE "InvoicePrintLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "CreditNotes" TO app_user;

-- 6. Invalidate Legacy Sessions on Key Rotation
UPDATE "RefreshTokens" SET "RevokedAt" = NOW() WHERE "RevokedAt" IS NULL;

-- 7. Hangfire background jobs live in their own schema, which the public-schema
--    grants above do not reach. Without this the API cannot start: Hangfire fails
--    to acquire its distributed locks and aborts with a PostgreSqlDistributedLockException.
--    Hangfire also creates its own tables on first run, so it needs CREATE here.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'hangfire') THEN
        EXECUTE 'CREATE SCHEMA hangfire';
    END IF;
END $$;

GRANT USAGE, CREATE ON SCHEMA hangfire TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hangfire TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA hangfire TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA hangfire GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA hangfire GRANT USAGE, SELECT ON SEQUENCES TO app_user;

