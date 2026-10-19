using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EnforceAppendOnlyAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Append-only enforcement can only be applied by a role that owns the tables.
            // Least-privilege runtime roles cannot create or grant on app_user, so this
            // warns instead of aborting the deploy. The complete set of grants (all seven
            // audit tables, not just these two) lives in scripts/setup-least-privilege-db.sql.
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        REVOKE UPDATE, DELETE ON ""PatientAuditLogs"" FROM app_user;
        REVOKE UPDATE, DELETE ON ""NotificationLogs"" FROM app_user;
        GRANT INSERT, SELECT ON ""PatientAuditLogs"" TO app_user;
        GRANT INSERT, SELECT ON ""NotificationLogs"" TO app_user;
    ELSE
        RAISE NOTICE 'app_user role not found; append-only grants skipped. Run scripts/setup-least-privilege-db.sql as the schema owner.';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Not privileged to enforce append-only audit for app_user. Run scripts/setup-least-privilege-db.sql as the schema owner.';
END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("REVOKE INSERT ON \"PatientAuditLogs\" FROM app_user;");
            migrationBuilder.Sql("REVOKE INSERT ON \"NotificationLogs\" FROM app_user;");
            migrationBuilder.Sql("GRANT UPDATE, DELETE ON \"PatientAuditLogs\" TO app_user;");
            migrationBuilder.Sql("GRANT UPDATE, DELETE ON \"NotificationLogs\" TO app_user;");
        }
    }
}
