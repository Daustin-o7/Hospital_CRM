using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantMembershipTokenFamilyAndAuthAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Patients_Phone",
                table: "Patients");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_DoctorId_Date_TimeSlot",
                table: "Appointments");

            migrationBuilder.AlterColumn<string>(
                name: "TokenHash",
                table: "RefreshTokens",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(512)",
                oldMaxLength: 512);

            migrationBuilder.AddColumn<Guid>(
                name: "ClinicId",
                table: "RefreshTokens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FamilyId",
                table: "RefreshTokens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "RefreshTokens",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "RefreshTokens",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Uhid",
                table: "Patients",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CaptureMethod",
                table: "PatientConsents",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "receptionist_assisted");

            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "PatientConsents",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "en");

            migrationBuilder.AddColumn<string>(
                name: "NoticeVersion",
                table: "PatientConsents",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "v1.0");

            migrationBuilder.AddColumn<string>(
                name: "QueueTrackingToken",
                table: "Appointments",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "TriageConfirmedAt",
                table: "Appointments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TriageConfirmedBy",
                table: "Appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TriageReasonCode",
                table: "Appointments",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AuthAuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    EventType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Outcome = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Detail = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuthAuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DoctorDailyQueueCounters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false, defaultValue: new Guid("00000000-0000-0000-0000-000000000000")),
                    DoctorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    LastToken = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoctorDailyQueueCounters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DoctorDailyQueueCounters_Users_DoctorId",
                        column: x => x.DoctorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TenantMemberships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: true),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantMemberships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantMemberships_Clinics_ClinicId",
                        column: x => x.ClinicId,
                        principalTable: "Clinics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TenantMemberships_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TenantMemberships_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_FamilyId",
                table: "RefreshTokens",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens",
                column: "TokenHash");

            migrationBuilder.CreateIndex(
                name: "IX_Patients_Phone",
                table: "Patients",
                column: "Phone");

            migrationBuilder.CreateIndex(
                name: "IX_Patients_TenantId_Uhid",
                table: "Patients",
                columns: new[] { "TenantId", "Uhid" },
                unique: true,
                filter: "\"Uhid\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_DoctorId",
                table: "Appointments",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_QueueTrackingToken",
                table: "Appointments",
                column: "QueueTrackingToken",
                unique: true,
                filter: "\"QueueTrackingToken\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_TenantId_DoctorId_Date_QueueToken",
                table: "Appointments",
                columns: new[] { "TenantId", "DoctorId", "Date", "QueueToken" },
                unique: true,
                filter: "\"QueueToken\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_TenantId_DoctorId_Date_TimeSlot",
                table: "Appointments",
                columns: new[] { "TenantId", "DoctorId", "Date", "TimeSlot" },
                unique: true,
                filter: "\"Status\" <> 6");

            migrationBuilder.CreateIndex(
                name: "IX_AuthAuditLogs_EventType_CreatedAt",
                table: "AuthAuditLogs",
                columns: new[] { "EventType", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuthAuditLogs_UserId",
                table: "AuthAuditLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorDailyQueueCounters_DoctorId",
                table: "DoctorDailyQueueCounters",
                column: "DoctorId");

            migrationBuilder.CreateIndex(
                name: "IX_DoctorDailyQueueCounters_TenantId_DoctorId_Date",
                table: "DoctorDailyQueueCounters",
                columns: new[] { "TenantId", "DoctorId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantMemberships_ClinicId",
                table: "TenantMemberships",
                column: "ClinicId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantMemberships_TenantId",
                table: "TenantMemberships",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantMemberships_UserId_TenantId_ClinicId",
                table: "TenantMemberships",
                columns: new[] { "UserId", "TenantId", "ClinicId" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            // Section 0: every existing clinic user becomes an explicit membership so the
            // login path can resolve scope from TenantMemberships instead of User.TenantId.
            migrationBuilder.Sql(@"
INSERT INTO ""TenantMemberships""
    (""Id"", ""UserId"", ""TenantId"", ""ClinicId"", ""Role"", ""IsDefault"", ""Status"", ""CreatedAt"", ""UpdatedAt"")
SELECT
    gen_random_uuid(),
    u.""Id"",
    u.""TenantId"",
    NULLIF(u.""ClinicId"", '00000000-0000-0000-0000-000000000000'::uuid),
    u.""Role"",
    TRUE,
    'active',
    now(),
    now()
FROM ""Users"" u
WHERE u.""TenantId"" IS NOT NULL
  AND u.""TenantId"" <> '00000000-0000-0000-0000-000000000000'::uuid
ON CONFLICT (""UserId"", ""TenantId"", ""ClinicId"") DO NOTHING;");

            // Same RLS backstop as the other tenant-owned tables. The table is new here, so it
            // never appeared in the 20261019170000 policy list.
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        ALTER TABLE ""DoctorDailyQueueCounters"" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation_policy ON ""DoctorDailyQueueCounters"";
        CREATE POLICY tenant_isolation_policy ON ""DoctorDailyQueueCounters""
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
        RAISE NOTICE 'app_user role not found; DoctorDailyQueueCounters RLS skipped. Run scripts/setup-least-privilege-db.sql as the schema owner.';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Not privileged to enable RLS on DoctorDailyQueueCounters. Run scripts/setup-least-privilege-db.sql as the schema owner.';
END $$;");

            // Auth events are evidence (DPDP / ledger integrity): append-only at the role level,
            // same pattern as the other audit tables.
            migrationBuilder.Sql(@"
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        REVOKE UPDATE, DELETE ON ""AuthAuditLogs"" FROM app_user;
        GRANT INSERT, SELECT ON ""AuthAuditLogs"" TO app_user;
    ELSE
        RAISE NOTICE 'app_user role not found; AuthAuditLogs append-only grants skipped. Run scripts/setup-least-privilege-db.sql as the schema owner.';
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Not privileged to enforce append-only on AuthAuditLogs. Run scripts/setup-least-privilege-db.sql as the schema owner.';
END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuthAuditLogs");

            migrationBuilder.DropTable(
                name: "DoctorDailyQueueCounters");

            migrationBuilder.DropTable(
                name: "TenantMemberships");

            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_FamilyId",
                table: "RefreshTokens");

            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens");

            migrationBuilder.DropIndex(
                name: "IX_Patients_Phone",
                table: "Patients");

            migrationBuilder.DropIndex(
                name: "IX_Patients_TenantId_Uhid",
                table: "Patients");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_DoctorId",
                table: "Appointments");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_QueueTrackingToken",
                table: "Appointments");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_TenantId_DoctorId_Date_QueueToken",
                table: "Appointments");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_TenantId_DoctorId_Date_TimeSlot",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "ClinicId",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "FamilyId",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "Uhid",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "CaptureMethod",
                table: "PatientConsents");

            migrationBuilder.DropColumn(
                name: "Language",
                table: "PatientConsents");

            migrationBuilder.DropColumn(
                name: "NoticeVersion",
                table: "PatientConsents");

            migrationBuilder.DropColumn(
                name: "QueueTrackingToken",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "TriageConfirmedAt",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "TriageConfirmedBy",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "TriageReasonCode",
                table: "Appointments");

            migrationBuilder.AlterColumn<string>(
                name: "TokenHash",
                table: "RefreshTokens",
                type: "character varying(512)",
                maxLength: 512,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(128)",
                oldMaxLength: 128);

            migrationBuilder.CreateIndex(
                name: "IX_Patients_Phone",
                table: "Patients",
                column: "Phone",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_DoctorId_Date_TimeSlot",
                table: "Appointments",
                columns: new[] { "DoctorId", "Date", "TimeSlot" },
                unique: true,
                filter: "\"Status\" <> 3");
        }
    }
}
