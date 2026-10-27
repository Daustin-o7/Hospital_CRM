using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <summary>
    /// AGENTS.md rule 4: audit tables are append-only at the database role, not only in app code.
    /// `scripts/setup-least-privilege-db.sql` was never applied to existing databases, and its
    /// schema-wide default privileges hand UPDATE/DELETE to every new table, so the guarantee
    /// decayed on each migration. This migration applies the revokes and installs a DDL trigger
    /// that keeps any later audit table on the same list append-only automatically.
    /// </summary>
    public partial class EnforceAuditAppendOnly : Migration
    {
        private const string AuditTables = @"'AppointmentHistories', 'AuthAuditLogs', 'ControlledSubstanceRegisters',
                'CreditNotes', 'DrugStockMovements', 'FinanceLedgerEntries',
                'ImpersonationLogs', 'ImpersonationPhiAccessLogs', 'InvoicePrintLogs',
                'MedicineSearchMissLogs', 'NotificationLogs', 'NurseAuditLogs',
                'PatientAuditLogs', 'PrescriptionPrintLogs', 'PriorityLogs'";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                DO $$
                DECLARE
                    t text;
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
                        RAISE NOTICE 'app_user role not found; audit append-only grants skipped.';
                        RETURN;
                    END IF;

                    FOREACH t IN ARRAY ARRAY[{AuditTables}] LOOP
                        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                   WHERE n.nspname = 'public' AND c.relname = t) THEN
                            EXECUTE format('REVOKE UPDATE, DELETE ON TABLE public.%I FROM app_user', t);
                            EXECUTE format('GRANT INSERT, SELECT ON TABLE public.%I TO app_user', t);
                        END IF;
                    END LOOP;

                    -- Break-glass sessions are the one field an audit row may still gain after insert.
                    BEGIN
                        GRANT UPDATE (""EndedAt"") ON TABLE ""ImpersonationLogs"" TO app_user;
                    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
                    END;

                    -- Dual-control approval is the one legitimate credit-note state change;
                    -- amount, reason and the original approver stay write-once.
                    BEGIN
                        GRANT UPDATE (""Status"", ""SecondApprovedByUserId"", ""IssuedAt"") ON TABLE ""CreditNotes"" TO app_user;
                    EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
                    END;
                EXCEPTION
                    WHEN insufficient_privilege THEN
                        RAISE WARNING 'Not privileged to set append-only grants; run migrations as the schema owner.';
                END $$;");

            migrationBuilder.Sql($@"
                CREATE OR REPLACE FUNCTION public.enforce_audit_append_only() RETURNS event_trigger
                LANGUAGE plpgsql AS $$
                DECLARE
                    audit_tables text[] := ARRAY[{AuditTables}];
                    r record;
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
                        RETURN;
                    END IF;

                    FOR r IN
                        SELECT c.relname
                        FROM pg_event_trigger_ddl_commands() d
                        JOIN pg_class c ON c.oid = d.objid
                        WHERE d.command_tag = 'CREATE TABLE' AND c.relname = ANY (audit_tables)
                    LOOP
                        EXECUTE format('REVOKE UPDATE, DELETE ON TABLE public.%I FROM app_user', r.relname);
                        EXECUTE format('GRANT INSERT, SELECT ON TABLE public.%I TO app_user', r.relname);
                    END LOOP;
                END $$;

                DO $$
                BEGIN
                    EXECUTE 'DROP EVENT TRIGGER IF EXISTS audit_append_only';
                    EXECUTE 'CREATE EVENT TRIGGER audit_append_only ON ddl_command_end
                             WHEN TAG IN (''CREATE TABLE'')
                             EXECUTE FUNCTION public.enforce_audit_append_only()';
                EXCEPTION
                    WHEN insufficient_privilege THEN
                        RAISE WARNING 'Not superuser; audit_append_only DDL trigger not installed. New audit tables need an explicit REVOKE.';
                END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP EVENT TRIGGER IF EXISTS audit_append_only;
                DROP FUNCTION IF EXISTS public.enforce_audit_append_only();

                DO $$
                DECLARE
                    t text;
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
                        RETURN;
                    END IF;

                    FOREACH t IN ARRAY ARRAY[" + AuditTables + @"] LOOP
                        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                   WHERE n.nspname = 'public' AND c.relname = t) THEN
                            EXECUTE format('GRANT UPDATE, DELETE ON TABLE public.%I TO app_user', t);
                        END IF;
                    END LOOP;
                END $$;");
        }
    }
}
