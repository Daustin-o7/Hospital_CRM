using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PaymentBridgeDevices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PaymentBridgeDevices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    SecretProtected = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PairingCodeHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PairingExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PairingAttempts = table.Column<int>(type: "integer", nullable: false),
                    PairedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentBridgeDevices", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentBridgeDevices_TenantId_RevokedAt",
                table: "PaymentBridgeDevices",
                columns: new[] { "TenantId", "RevokedAt" });

            // RLS: a row is only visible to its tenant, matching the other tenant tables.
            migrationBuilder.Sql(@"
                ALTER TABLE ""PaymentBridgeDevices"" ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_policy ON ""PaymentBridgeDevices"";
                CREATE POLICY tenant_isolation_policy ON ""PaymentBridgeDevices""
                AS PERMISSIVE
                FOR ALL
                TO app_user
                USING (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR ""TenantId"" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR ""TenantId"" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentBridgeDevices");
        }
    }
}
