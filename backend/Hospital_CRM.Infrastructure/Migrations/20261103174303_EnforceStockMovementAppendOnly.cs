using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <summary>
    /// FR-08: StockMovements is append-only (the running balance is derived, never edited), but the
    /// revoke list in EnforceAuditAppendOnly missed it, so app_user could rewrite inventory history.
    /// This migration revokes UPDATE/DELETE on the table and adds it to the DDL trigger's list.
    /// </summary>
    public partial class EnforceStockMovementAppendOnly : Migration
    {
        private const string AuditTables = @"'AppointmentHistories', 'AuthAuditLogs', 'ControlledSubstanceRegisters',
                'CreditNotes', 'DrugStockMovements', 'FinanceLedgerEntries',
                'ImpersonationLogs', 'ImpersonationPhiAccessLogs', 'InvoicePrintLogs',
                'MedicineSearchMissLogs', 'NotificationLogs', 'NurseAuditLogs',
                'PatientAuditLogs', 'PrescriptionPrintLogs', 'PriorityLogs', 'StockMovements'";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
                        RAISE NOTICE 'app_user role not found; stock movement append-only grants skipped.';
                        RETURN;
                    END IF;

                    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                               WHERE n.nspname = 'public' AND c.relname = 'StockMovements') THEN
                        REVOKE UPDATE, DELETE ON TABLE public.""StockMovements"" FROM app_user;
                        GRANT INSERT, SELECT ON TABLE public.""StockMovements"" TO app_user;
                    END IF;
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
                END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
                        RETURN;
                    END IF;

                    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                               WHERE n.nspname = 'public' AND c.relname = 'StockMovements') THEN
                        GRANT UPDATE, DELETE ON TABLE public.""StockMovements"" TO app_user;
                    END IF;
                END $$;");
        }
    }
}
