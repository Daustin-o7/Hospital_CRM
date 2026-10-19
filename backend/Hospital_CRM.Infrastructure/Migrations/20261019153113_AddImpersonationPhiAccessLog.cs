using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddImpersonationPhiAccessLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImpersonationPhiAccessLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ImpersonationId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlatformAdminId = table.Column<Guid>(type: "uuid", nullable: false),
                    ImpersonatedUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    Path = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Method = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    StatusCode = table.Column<int>(type: "integer", nullable: false),
                    Timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImpersonationPhiAccessLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImpersonationPhiAccessLogs_ImpersonationId",
                table: "ImpersonationPhiAccessLogs",
                column: "ImpersonationId");

            // FR-08: this is audit evidence - append-only for the application role.
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        GRANT INSERT, SELECT ON ""ImpersonationPhiAccessLogs"" TO app_user;
        REVOKE UPDATE, DELETE ON ""ImpersonationPhiAccessLogs"" FROM app_user;
    ELSE
        RAISE NOTICE 'app_user role not found; ImpersonationPhiAccessLogs append-only grant skipped.';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Not privileged to set append-only grants on ImpersonationPhiAccessLogs.';
END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImpersonationPhiAccessLogs");
        }
    }
}
