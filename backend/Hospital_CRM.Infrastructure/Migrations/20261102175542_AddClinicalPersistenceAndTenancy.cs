using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddClinicalPersistenceAndTenancy : Migration
    {
        private static readonly string[] ClinicalTenantTables = new[]
        {
            "Consultations",
            "Prescriptions",
            "LabResults",
            "PatientConsents"
        };

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Specialty",
                table: "Users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Specialty",
                table: "TenantMemberships",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OdontogramJson",
                table: "Consultations",
                type: "text",
                nullable: true);

            // Step 1: Add TenantId columns as nullable initially so existing rows can be backfilled
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "Consultations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "Prescriptions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "LabResults",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "PatientConsents",
                type: "uuid",
                nullable: true);

            // Step 2: Backfill TenantId from owning parent entities
            // 2a. Consultations <- Appointments
            migrationBuilder.Sql(@"
UPDATE ""Consultations"" c
SET ""TenantId"" = a.""TenantId""
FROM ""Appointments"" a
WHERE c.""AppointmentId"" = a.""Id""
  AND (c.""TenantId"" IS NULL OR c.""TenantId"" = '00000000-0000-0000-0000-000000000000'::uuid);
UPDATE ""Consultations"" SET ""TenantId"" = '00000000-0000-0000-0000-000000000000'::uuid WHERE ""TenantId"" IS NULL;
");

            // 2b. Prescriptions <- Consultations
            migrationBuilder.Sql(@"
UPDATE ""Prescriptions"" p
SET ""TenantId"" = c.""TenantId""
FROM ""Consultations"" c
WHERE p.""ConsultationId"" = c.""Id""
  AND (p.""TenantId"" IS NULL OR p.""TenantId"" = '00000000-0000-0000-0000-000000000000'::uuid);
UPDATE ""Prescriptions"" SET ""TenantId"" = '00000000-0000-0000-0000-000000000000'::uuid WHERE ""TenantId"" IS NULL;
");

            // 2c. LabResults <- LabOrders
            migrationBuilder.Sql(@"
UPDATE ""LabResults"" lr
SET ""TenantId"" = lo.""TenantId""
FROM ""LabOrders"" lo
WHERE lr.""LabOrderId"" = lo.""Id""
  AND (lr.""TenantId"" IS NULL OR lr.""TenantId"" = '00000000-0000-0000-0000-000000000000'::uuid);
UPDATE ""LabResults"" SET ""TenantId"" = '00000000-0000-0000-0000-000000000000'::uuid WHERE ""TenantId"" IS NULL;
");

            // 2d. PatientConsents <- Patients
            migrationBuilder.Sql(@"
UPDATE ""PatientConsents"" pc
SET ""TenantId"" = p.""TenantId""
FROM ""Patients"" p
WHERE pc.""PatientId"" = p.""Id""
  AND (pc.""TenantId"" IS NULL OR pc.""TenantId"" = '00000000-0000-0000-0000-000000000000'::uuid);
UPDATE ""PatientConsents"" SET ""TenantId"" = '00000000-0000-0000-0000-000000000000'::uuid WHERE ""TenantId"" IS NULL;
");

            // Step 3: Enforce NOT NULL and default value
            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                table: "Consultations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                table: "Prescriptions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                table: "LabResults",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                table: "PatientConsents",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            // Step 4: Indexes for tenant lookups
            migrationBuilder.CreateIndex(
                name: "IX_Prescriptions_TenantId",
                table: "Prescriptions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_LabResults_TenantId",
                table: "LabResults",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientConsents_TenantId",
                table: "PatientConsents",
                column: "TenantId");

            // Step 5: Enable Row-Level Security (RLS) policies for dual-layer isolation
            foreach (var table in ClinicalTenantTables)
            {
                migrationBuilder.Sql($@"
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        ALTER TABLE ""{table}"" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation_policy ON ""{table}"";
        CREATE POLICY tenant_isolation_policy ON ""{table}""
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
    ELSE
        RAISE NOTICE 'app_user role not found; {table} RLS skipped.';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Not privileged to enable RLS on {table}.';
END $$;");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var table in ClinicalTenantTables)
            {
                migrationBuilder.Sql($@"
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        DROP POLICY IF EXISTS tenant_isolation_policy ON ""{table}"";
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN NULL;
END $$;");
            }

            migrationBuilder.DropIndex(
                name: "IX_Prescriptions_TenantId",
                table: "Prescriptions");

            migrationBuilder.DropIndex(
                name: "IX_LabResults_TenantId",
                table: "LabResults");

            migrationBuilder.DropIndex(
                name: "IX_PatientConsents_TenantId",
                table: "PatientConsents");

            migrationBuilder.DropColumn(
                name: "Specialty",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Specialty",
                table: "TenantMemberships");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Prescriptions");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "PatientConsents");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "LabResults");

            migrationBuilder.DropColumn(
                name: "OdontogramJson",
                table: "Consultations");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Consultations");
        }
    }
}
