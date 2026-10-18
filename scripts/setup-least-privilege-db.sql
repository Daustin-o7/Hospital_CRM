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

GRANT INSERT, SELECT ON TABLE "PatientAuditLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "NurseAuditLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "NotificationLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "PriorityLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "ImpersonationLogs" TO app_user;
GRANT INSERT, SELECT ON TABLE "AppointmentHistories" TO app_user;
GRANT INSERT, SELECT ON TABLE "ControlledSubstanceRegisters" TO app_user;
