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
            migrationBuilder.Sql(@"
DO $$
BEGIN
    CREATE ROLE app_user;
EXCEPTION WHEN duplicate_object THEN null;
END $$;");
            migrationBuilder.Sql("REVOKE UPDATE, DELETE ON \"PatientAuditLogs\" FROM app_user;");
            migrationBuilder.Sql("REVOKE UPDATE, DELETE ON \"NotificationLogs\" FROM app_user;");
            migrationBuilder.Sql("GRANT INSERT ON \"PatientAuditLogs\" TO app_user;");
            migrationBuilder.Sql("GRANT INSERT ON \"NotificationLogs\" TO app_user;");
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
