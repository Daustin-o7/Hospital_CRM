using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Section2TriageVitalsAndStaffRoster : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CriticalAlerts",
                table: "ShiftHandovers",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatHappened",
                table: "ShiftHandovers",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "WhatIsPending",
                table: "ShiftHandovers",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "DurationHours",
                table: "NurseShifts",
                type: "numeric(4,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsLocked",
                table: "NurseShifts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "RosterId",
                table: "NurseShifts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ShiftTemplateId",
                table: "NurseShifts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StationOrWard",
                table: "NurseShifts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedOnBehalfOfUserId",
                table: "LeaveRequests",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CertificateSeen",
                table: "LeaveRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "CoverageGapAlertCreated",
                table: "LeaveRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "HalfDayPeriod",
                table: "LeaveRequests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsHalfDay",
                table: "LeaveRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "AuthorityProxies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    DelegatorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DesigneeUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Permissions = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ValidFrom = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ValidUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuthorityProxies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuthorityProxies_Users_DelegatorUserId",
                        column: x => x.DelegatorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuthorityProxies_Users_DesigneeUserId",
                        column: x => x.DesigneeUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PatientVitals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    SystolicBp = table.Column<int>(type: "integer", nullable: true),
                    DiastolicBp = table.Column<int>(type: "integer", nullable: true),
                    HeartRate = table.Column<int>(type: "integer", nullable: true),
                    Temperature = table.Column<decimal>(type: "numeric(4,1)", nullable: true),
                    RespiratoryRate = table.Column<int>(type: "integer", nullable: true),
                    SpO2 = table.Column<int>(type: "integer", nullable: true),
                    WeightKg = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    HeightCm = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    Bmi = table.Column<decimal>(type: "numeric(4,1)", nullable: true),
                    BloodGlucoseMgDl = table.Column<decimal>(type: "numeric(5,1)", nullable: true),
                    Allergies = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    BedsideObservations = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RecordedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PatientVitals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PatientVitals_Appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalTable: "Appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PatientVitals_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PatientVitals_Users_RecordedByUserId",
                        column: x => x.RecordedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ShiftChangeRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestType = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequesterNurseProfileId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequesterShiftId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetNurseProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetShiftId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequestedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ApprovedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AppliedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedOnBehalfOfUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftChangeRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShiftChangeRequests_NurseProfiles_RequesterNurseProfileId",
                        column: x => x.RequesterNurseProfileId,
                        principalTable: "NurseProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ShiftChangeRequests_NurseProfiles_TargetNurseProfileId",
                        column: x => x.TargetNurseProfileId,
                        principalTable: "NurseProfiles",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ShiftChangeRequests_NurseShifts_RequesterShiftId",
                        column: x => x.RequesterShiftId,
                        principalTable: "NurseShifts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ShiftChangeRequests_NurseShifts_TargetShiftId",
                        column: x => x.TargetShiftId,
                        principalTable: "NurseShifts",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ShiftTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    StartTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    EndTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CrossesMidnight = table.Column<bool>(type: "boolean", nullable: false),
                    DurationHours = table.Column<decimal>(type: "numeric(4,2)", nullable: false),
                    RequiredCoverage = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShiftTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StaffRosters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    PublishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PublishedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    LockedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LockedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffRosters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StaffTeams",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    WardOrDepartment = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffTeams", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StaffAnnouncements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    TeamId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Content = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffAnnouncements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StaffAnnouncements_StaffTeams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "StaffTeams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StaffAnnouncements_Users_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StaffTeamMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TeamId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleInTeam = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    JoinedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffTeamMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StaffTeamMembers_StaffTeams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "StaffTeams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StaffTeamMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NurseShifts_RosterId",
                table: "NurseShifts",
                column: "RosterId");

            migrationBuilder.CreateIndex(
                name: "IX_NurseShifts_ShiftTemplateId",
                table: "NurseShifts",
                column: "ShiftTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_AuthorityProxies_DelegatorUserId",
                table: "AuthorityProxies",
                column: "DelegatorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AuthorityProxies_DesigneeUserId",
                table: "AuthorityProxies",
                column: "DesigneeUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AuthorityProxies_TenantId_ClinicId_ValidUntil_IsRevoked",
                table: "AuthorityProxies",
                columns: new[] { "TenantId", "ClinicId", "ValidUntil", "IsRevoked" });

            migrationBuilder.CreateIndex(
                name: "IX_PatientVitals_AppointmentId",
                table: "PatientVitals",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientVitals_PatientId",
                table: "PatientVitals",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientVitals_RecordedByUserId",
                table: "PatientVitals",
                column: "RecordedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientVitals_TenantId_AppointmentId",
                table: "PatientVitals",
                columns: new[] { "TenantId", "AppointmentId" });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftChangeRequests_RequesterNurseProfileId",
                table: "ShiftChangeRequests",
                column: "RequesterNurseProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftChangeRequests_RequesterShiftId",
                table: "ShiftChangeRequests",
                column: "RequesterShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftChangeRequests_TargetNurseProfileId",
                table: "ShiftChangeRequests",
                column: "TargetNurseProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftChangeRequests_TargetShiftId",
                table: "ShiftChangeRequests",
                column: "TargetShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_ShiftChangeRequests_TenantId_ClinicId_Status",
                table: "ShiftChangeRequests",
                columns: new[] { "TenantId", "ClinicId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ShiftTemplates_TenantId_ClinicId_IsActive",
                table: "ShiftTemplates",
                columns: new[] { "TenantId", "ClinicId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_StaffAnnouncements_AuthorUserId",
                table: "StaffAnnouncements",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAnnouncements_TeamId",
                table: "StaffAnnouncements",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffAnnouncements_TenantId_ClinicId_CreatedAt",
                table: "StaffAnnouncements",
                columns: new[] { "TenantId", "ClinicId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_StaffRosters_TenantId_ClinicId_StartDate_EndDate",
                table: "StaffRosters",
                columns: new[] { "TenantId", "ClinicId", "StartDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_StaffTeamMembers_TeamId_UserId",
                table: "StaffTeamMembers",
                columns: new[] { "TeamId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StaffTeamMembers_UserId",
                table: "StaffTeamMembers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffTeams_TenantId_ClinicId_Name",
                table: "StaffTeams",
                columns: new[] { "TenantId", "ClinicId", "Name" });

            migrationBuilder.AddForeignKey(
                name: "FK_NurseShifts_ShiftTemplates_ShiftTemplateId",
                table: "NurseShifts",
                column: "ShiftTemplateId",
                principalTable: "ShiftTemplates",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_NurseShifts_StaffRosters_RosterId",
                table: "NurseShifts",
                column: "RosterId",
                principalTable: "StaffRosters",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_NurseShifts_ShiftTemplates_ShiftTemplateId",
                table: "NurseShifts");

            migrationBuilder.DropForeignKey(
                name: "FK_NurseShifts_StaffRosters_RosterId",
                table: "NurseShifts");

            migrationBuilder.DropTable(
                name: "AuthorityProxies");

            migrationBuilder.DropTable(
                name: "PatientVitals");

            migrationBuilder.DropTable(
                name: "ShiftChangeRequests");

            migrationBuilder.DropTable(
                name: "ShiftTemplates");

            migrationBuilder.DropTable(
                name: "StaffAnnouncements");

            migrationBuilder.DropTable(
                name: "StaffRosters");

            migrationBuilder.DropTable(
                name: "StaffTeamMembers");

            migrationBuilder.DropTable(
                name: "StaffTeams");

            migrationBuilder.DropIndex(
                name: "IX_NurseShifts_RosterId",
                table: "NurseShifts");

            migrationBuilder.DropIndex(
                name: "IX_NurseShifts_ShiftTemplateId",
                table: "NurseShifts");

            migrationBuilder.DropColumn(
                name: "CriticalAlerts",
                table: "ShiftHandovers");

            migrationBuilder.DropColumn(
                name: "WhatHappened",
                table: "ShiftHandovers");

            migrationBuilder.DropColumn(
                name: "WhatIsPending",
                table: "ShiftHandovers");

            migrationBuilder.DropColumn(
                name: "DurationHours",
                table: "NurseShifts");

            migrationBuilder.DropColumn(
                name: "IsLocked",
                table: "NurseShifts");

            migrationBuilder.DropColumn(
                name: "RosterId",
                table: "NurseShifts");

            migrationBuilder.DropColumn(
                name: "ShiftTemplateId",
                table: "NurseShifts");

            migrationBuilder.DropColumn(
                name: "StationOrWard",
                table: "NurseShifts");

            migrationBuilder.DropColumn(
                name: "ApprovedOnBehalfOfUserId",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "CertificateSeen",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "CoverageGapAlertCreated",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "HalfDayPeriod",
                table: "LeaveRequests");

            migrationBuilder.DropColumn(
                name: "IsHalfDay",
                table: "LeaveRequests");
        }
    }
}
