using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantsTableAndIsolateTenantIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                table: "Users",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldDefaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                table: "Clinics",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldDefaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SubscriptionTier = table.Column<int>(type: "integer", nullable: false),
                    SubscriptionStatus = table.Column<int>(type: "integer", nullable: false),
                    ActivatedModules = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false, defaultValue: "core"),
                    SubscriptionEndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                });

            // A3.1 Data Migration: Abort unless exactly one clinic exists, create the Tenant row,
            // point the existing Clinic at it, and dynamically backfill all tenant-scoped tables from Guid.Empty.
            migrationBuilder.Sql(@"
DO $$
DECLARE
    clinic_count integer;
    c_record RECORD;
    new_tenant_id uuid;
    r RECORD;
BEGIN
    SELECT COUNT(*) INTO clinic_count FROM ""Clinics"";
    IF clinic_count = 0 THEN
        -- Nothing to isolate yet. Migrations run before seeding, so on a fresh database the seed
        -- owns tenant creation; inserting a tenant here instead leaves an orphan Primary Clinic
        -- row with no clinic and no users, which the platform-admin console then lists alongside
        -- the real one.
        NULL;
    ELSIF clinic_count = 1 THEN
        SELECT * INTO c_record FROM ""Clinics"" LIMIT 1;
        -- If clinic's TenantId is already a valid non-empty UUID and already in Tenants, reuse, else gen_random_uuid()
        IF c_record.""TenantId"" IS NOT NULL AND c_record.""TenantId"" <> '00000000-0000-0000-0000-000000000000'::uuid THEN
            new_tenant_id := c_record.""TenantId"";
        ELSE
            new_tenant_id := gen_random_uuid();
        END IF;

        IF NOT EXISTS (SELECT 1 FROM ""Tenants"" WHERE ""Id"" = new_tenant_id) THEN
            INSERT INTO ""Tenants"" (""Id"", ""Name"", ""SubscriptionTier"", ""SubscriptionStatus"", ""ActivatedModules"", ""SubscriptionEndsAt"", ""CreatedAt"", ""UpdatedAt"")
            VALUES (new_tenant_id, c_record.""Name"", c_record.""SubscriptionTier"", c_record.""SubscriptionStatus"", c_record.""ActivatedModules"", c_record.""SubscriptionEndsAt"", c_record.""CreatedAt"", c_record.""UpdatedAt"");
        END IF;

        UPDATE ""Clinics"" SET ""TenantId"" = new_tenant_id WHERE ""Id"" = c_record.""Id"";

        -- Dynamically update all tables in public schema that possess a TenantId column
        FOR r IN 
            SELECT table_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND column_name = 'TenantId' 
              AND table_name NOT IN ('Clinics', 'Tenants')
        LOOP
            EXECUTE format('UPDATE %I SET ""TenantId"" = $1 WHERE ""TenantId"" = ''00000000-0000-0000-0000-000000000000''::uuid', r.table_name) USING new_tenant_id;
        END LOOP;

        -- Non-platformadmin users join the tenant; platformadmin gets null.
        -- UserRole: ClinicAdmin=0, Doctor=1, Receptionist=2, PlatformAdmin=3, Pharmacist=4, Nurse=5.
        -- Do not use a bare literal here without re-checking that enum: this was written as 5 (Nurse),
        -- which detached every nurse from its tenant and attached the platform admin instead.
        UPDATE ""Users"" SET ""TenantId"" = new_tenant_id WHERE (""TenantId"" IS NULL OR ""TenantId"" = '00000000-0000-0000-0000-000000000000'::uuid) AND ""Role"" <> 3;
        UPDATE ""Users"" SET ""TenantId"" = NULL WHERE ""Role"" = 3;

        -- Revoke all refresh tokens at cutover so no old token carries stale claim
        DELETE FROM ""RefreshTokens"";
    ELSE
        RAISE EXCEPTION 'A3 migration aborted: expected exactly 1 clinic, found %', clinic_count;
    END IF;
END $$;");

            migrationBuilder.CreateIndex(
                name: "IX_Clinics_TenantId",
                table: "Clinics",
                column: "TenantId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Clinics_Tenants_TenantId",
                table: "Clinics",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Clinics_Tenants_TenantId",
                table: "Clinics");

            migrationBuilder.DropTable(
                name: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Clinics_TenantId",
                table: "Clinics");

            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                table: "Users",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                table: "Clinics",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid");
        }
    }
}
