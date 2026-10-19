using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AllowImpersonationLogEndedAtUpdate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        GRANT UPDATE (""EndedAt"") ON ""ImpersonationLogs"" TO app_user;
    ELSE
        RAISE NOTICE 'app_user role not found; ImpersonationLogs EndedAt update grant skipped.';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Not privileged to grant update on ImpersonationLogs to app_user.';
END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        REVOKE UPDATE (""EndedAt"") ON ""ImpersonationLogs"" FROM app_user;
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Not privileged to revoke update on ImpersonationLogs from app_user.';
END $$;");
        }
    }
}
