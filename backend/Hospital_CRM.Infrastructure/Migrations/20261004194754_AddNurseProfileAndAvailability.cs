using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNurseProfileAndAvailability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StaffInvites_ClinicId_Email_AcceptedAt",
                table: "StaffInvites");

            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                table: "StaffInvites",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Designation",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactName",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactPhone",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactRelation",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "EmploymentStatus",
                table: "StaffInvites",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "EmploymentType",
                table: "StaffInvites",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "GraduationYear",
                table: "StaffInvites",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Institution",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Languages",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LicenseAuthority",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateOnly>(
                name: "LicenseExpiryDate",
                table: "StaffInvites",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "LicenseIssueDate",
                table: "StaffInvites",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LicenseNumber",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "NurseProfileId",
                table: "StaffInvites",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NursingQualification",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ShiftPreferencesJson",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Skills",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Specialization",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                table: "StaffInvites",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "WardId",
                table: "StaffInvites",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkRestrictionsJson",
                table: "StaffInvites",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "YearsExperience",
                table: "StaffInvites",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "NurseProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false, defaultValue: new Guid("00000000-0000-0000-0000-000000000000")),
                    DepartmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    WardId = table.Column<Guid>(type: "uuid", nullable: true),
                    Designation = table.Column<string>(type: "text", nullable: false),
                    EmploymentType = table.Column<int>(type: "integer", nullable: false),
                    JoiningDate = table.Column<DateOnly>(type: "date", nullable: false),
                    SupervisorId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    LicenseNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LicenseAuthority = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LicenseIssueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    LicenseExpiryDate = table.Column<DateOnly>(type: "date", nullable: false),
                    NursingQualification = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Institution = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    GraduationYear = table.Column<int>(type: "integer", nullable: false),
                    Specialization = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    YearsExperience = table.Column<int>(type: "integer", nullable: false),
                    Skills = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Languages = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    EmergencyContactName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    EmergencyContactPhone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EmergencyContactRelation = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DocumentsJson = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    ShiftPreferencesJson = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    WorkRestrictionsJson = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NurseProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NurseProfiles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NurseAvailabilities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NurseProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false, defaultValue: new Guid("00000000-0000-0000-0000-000000000000")),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    PreferredShift = table.Column<int>(type: "integer", nullable: false),
                    PreferredWardId = table.Column<Guid>(type: "uuid", nullable: true),
                    NightShiftWilling = table.Column<bool>(type: "boolean", nullable: false),
                    WeekendWilling = table.Column<bool>(type: "boolean", nullable: false),
                    OvertimeWilling = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NurseAvailabilities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NurseAvailabilities_NurseProfiles_NurseProfileId",
                        column: x => x.NurseProfileId,
                        principalTable: "NurseProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StaffInvites_ClinicId",
                table: "StaffInvites",
                column: "ClinicId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffInvites_NurseProfileId",
                table: "StaffInvites",
                column: "NurseProfileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StaffInvites_TenantId_ClinicId_Email_AcceptedAt",
                table: "StaffInvites",
                columns: new[] { "TenantId", "ClinicId", "Email", "AcceptedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_NurseAvailabilities_NurseProfileId",
                table: "NurseAvailabilities",
                column: "NurseProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_NurseAvailabilities_TenantId_NurseProfileId_StartDate_EndDa~",
                table: "NurseAvailabilities",
                columns: new[] { "TenantId", "NurseProfileId", "StartDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_NurseProfiles_TenantId_UserId",
                table: "NurseProfiles",
                columns: new[] { "TenantId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NurseProfiles_TenantId_WardId",
                table: "NurseProfiles",
                columns: new[] { "TenantId", "WardId" });

            migrationBuilder.CreateIndex(
                name: "IX_NurseProfiles_UserId",
                table: "NurseProfiles",
                column: "UserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_StaffInvites_NurseProfiles_NurseProfileId",
                table: "StaffInvites",
                column: "NurseProfileId",
                principalTable: "NurseProfiles",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StaffInvites_NurseProfiles_NurseProfileId",
                table: "StaffInvites");

            migrationBuilder.DropTable(
                name: "NurseAvailabilities");

            migrationBuilder.DropTable(
                name: "NurseProfiles");

            migrationBuilder.DropIndex(
                name: "IX_StaffInvites_ClinicId",
                table: "StaffInvites");

            migrationBuilder.DropIndex(
                name: "IX_StaffInvites_NurseProfileId",
                table: "StaffInvites");

            migrationBuilder.DropIndex(
                name: "IX_StaffInvites_TenantId_ClinicId_Email_AcceptedAt",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "Designation",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "EmergencyContactName",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "EmergencyContactPhone",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "EmergencyContactRelation",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "EmploymentStatus",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "EmploymentType",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "GraduationYear",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "Institution",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "Languages",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "LicenseAuthority",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "LicenseExpiryDate",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "LicenseIssueDate",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "LicenseNumber",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "NurseProfileId",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "NursingQualification",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "ShiftPreferencesJson",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "Skills",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "Specialization",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "WardId",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "WorkRestrictionsJson",
                table: "StaffInvites");

            migrationBuilder.DropColumn(
                name: "YearsExperience",
                table: "StaffInvites");

            migrationBuilder.CreateIndex(
                name: "IX_StaffInvites_ClinicId_Email_AcceptedAt",
                table: "StaffInvites",
                columns: new[] { "ClinicId", "Email", "AcceptedAt" });
        }
    }
}
