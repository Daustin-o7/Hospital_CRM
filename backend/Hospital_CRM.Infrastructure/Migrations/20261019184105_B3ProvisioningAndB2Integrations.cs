using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class B3ProvisioningAndB2Integrations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RazorpayOrderId",
                table: "Payments",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "Payments",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "Utr",
                table: "Payments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProcessedWebhookEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    EventId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric", nullable: true),
                    Utr = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Reference = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    PaymentId = table.Column<Guid>(type: "uuid", nullable: true),
                    RawPayload = table.Column<string>(type: "text", nullable: true),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessedWebhookEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenantIntegrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    MerchantId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    SecretProtected = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    WebhookPathToken = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    LastVerifiedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantIntegrations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TenantId_CreatedAt",
                table: "Payments",
                columns: new[] { "TenantId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ProcessedWebhookEvents_Provider_EventId",
                table: "ProcessedWebhookEvents",
                columns: new[] { "Provider", "EventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProcessedWebhookEvents_TenantId_Status",
                table: "ProcessedWebhookEvents",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantIntegrations_TenantId_Provider",
                table: "TenantIntegrations",
                columns: new[] { "TenantId", "Provider" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantIntegrations_WebhookPathToken",
                table: "TenantIntegrations",
                column: "WebhookPathToken",
                unique: true);

            // B3/F1: users created through the invite flow before the tenant backfill have
            // ClinicId but no TenantId. Without it their token carries no tenant claim and
            // both the EF query filter and RLS hide every row from them.
            migrationBuilder.Sql("""
                UPDATE "Users" u
                SET "TenantId" = c."TenantId"
                FROM "Clinics" c
                WHERE u."ClinicId" = c."Id"
                  AND u."TenantId" IS NULL
                  AND u."ClinicId" IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE "StaffInvites" i
                SET "TenantId" = c."TenantId"
                FROM "Clinics" c
                WHERE i."ClinicId" = c."Id"
                  AND i."TenantId" = '00000000-0000-0000-0000-000000000000';
                """);

            // B2/F5: payments now carry a tenant so RLS can cover them.
            migrationBuilder.Sql("""
                UPDATE "Payments" p
                SET "TenantId" = i."TenantId"
                FROM "Invoices" i
                WHERE p."InvoiceId" = i."Id"
                  AND p."TenantId" = '00000000-0000-0000-0000-000000000000';
                """);

            // B2: RLS for the two new tenant-scoped tables. TenantIntegrations is
            // deliberately excluded: the anonymous webhook must read it before it can
            // establish the tenant, so it is protected by the unguessable path token and
            // the explicit tenant predicate in the controller instead.
            migrationBuilder.Sql("""
                ALTER TABLE "Payments" ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_policy ON "Payments";
                CREATE POLICY tenant_isolation_policy ON "Payments"
                AS PERMISSIVE
                FOR ALL
                TO app_user
                USING (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR "TenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR "TenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                );

                ALTER TABLE "ProcessedWebhookEvents" ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_policy ON "ProcessedWebhookEvents";
                CREATE POLICY tenant_isolation_policy ON "ProcessedWebhookEvents"
                AS PERMISSIVE
                FOR ALL
                TO app_user
                USING (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR "TenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                )
                WITH CHECK (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR "TenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProcessedWebhookEvents");

            migrationBuilder.DropTable(
                name: "TenantIntegrations");

            migrationBuilder.DropIndex(
                name: "IX_Payments_TenantId_CreatedAt",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "RazorpayOrderId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "Utr",
                table: "Payments");
        }
    }
}
