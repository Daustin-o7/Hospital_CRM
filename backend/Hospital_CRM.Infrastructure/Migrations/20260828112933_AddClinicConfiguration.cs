using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddClinicConfiguration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ClinicHours_ClinicId_DayOfWeek",
                table: "ClinicHours");

            migrationBuilder.DropIndex(
                name: "IX_ClinicHolidays_ClinicId_Date",
                table: "ClinicHolidays");

            migrationBuilder.RenameColumn(
                name: "Date",
                table: "ClinicHolidays",
                newName: "StartDate");

            migrationBuilder.AddColumn<string>(
                name: "AccentColor",
                table: "Clinics",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "Clinics",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "BufferMinutes",
                table: "Clinics",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CancellationWindowHours",
                table: "Clinics",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "Clinics",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DarkLogoUrl",
                table: "Clinics",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DateFormat",
                table: "Clinics",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "DefaultAppointmentDurationMinutes",
                table: "Clinics",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "DefaultConsultationFee",
                table: "Clinics",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DefaultGstRate",
                table: "Clinics",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "DefaultInvoiceStatus",
                table: "Clinics",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Clinics",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FaviconUrl",
                table: "Clinics",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoicePrefix",
                table: "Clinics",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "Clinics",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LegalName",
                table: "Clinics",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LightLogoUrl",
                table: "Clinics",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "Clinics",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxAdvanceBookingDays",
                table: "Clinics",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MinAdvanceBookingHours",
                table: "Clinics",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "NoShowHandlingEnabled",
                table: "Clinics",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "OrganizationType",
                table: "Clinics",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "OverbookingAllowed",
                table: "Clinics",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "Clinics",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrimaryColor",
                table: "Clinics",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "QueueEnabled",
                table: "Clinics",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ReschedulingAllowed",
                table: "Clinics",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "SameDayBookingAllowed",
                table: "Clinics",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SecondaryColor",
                table: "Clinics",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TimeFormat",
                table: "Clinics",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Timezone",
                table: "Clinics",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TokenFormat",
                table: "Clinics",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TokenResetFrequency",
                table: "Clinics",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "TokenStartNumber",
                table: "Clinics",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "Clinics",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<bool>(
                name: "WalkInsAllowed",
                table: "Clinics",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Website",
                table: "Clinics",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "ClinicHours",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<int>(
                name: "ShiftIndex",
                table: "ClinicHours",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "ClinicHours",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "ClinicHolidays",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "EndDate",
                table: "ClinicHolidays",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "InternalNote",
                table: "ClinicHolidays",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "ClinicHolidays",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "RecurringAnnually",
                table: "ClinicHolidays",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "ClinicHolidays",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.CreateTable(
                name: "ClinicSpecialHours",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    OpenTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CloseTime = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicSpecialHours", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClinicSpecialHours_Clinics_ClinicId",
                        column: x => x.ClinicId,
                        principalTable: "Clinics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClinicHours_ClinicId_DayOfWeek_ShiftIndex",
                table: "ClinicHours",
                columns: new[] { "ClinicId", "DayOfWeek", "ShiftIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClinicHolidays_ClinicId",
                table: "ClinicHolidays",
                column: "ClinicId");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicSpecialHours_ClinicId_Date",
                table: "ClinicSpecialHours",
                columns: new[] { "ClinicId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClinicSpecialHours");

            migrationBuilder.DropIndex(
                name: "IX_ClinicHours_ClinicId_DayOfWeek_ShiftIndex",
                table: "ClinicHours");

            migrationBuilder.DropIndex(
                name: "IX_ClinicHolidays_ClinicId",
                table: "ClinicHolidays");

            migrationBuilder.DropColumn(
                name: "AccentColor",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "Address",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "BufferMinutes",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "CancellationWindowHours",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "DarkLogoUrl",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "DateFormat",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "DefaultAppointmentDurationMinutes",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "DefaultConsultationFee",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "DefaultGstRate",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "DefaultInvoiceStatus",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "FaviconUrl",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "InvoicePrefix",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "Language",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "LegalName",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "LightLogoUrl",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "MaxAdvanceBookingDays",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "MinAdvanceBookingHours",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "NoShowHandlingEnabled",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "OrganizationType",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "OverbookingAllowed",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "PrimaryColor",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "QueueEnabled",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "ReschedulingAllowed",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "SameDayBookingAllowed",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "SecondaryColor",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "TimeFormat",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "Timezone",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "TokenFormat",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "TokenResetFrequency",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "TokenStartNumber",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "WalkInsAllowed",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "Website",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "ClinicHours");

            migrationBuilder.DropColumn(
                name: "ShiftIndex",
                table: "ClinicHours");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "ClinicHours");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "ClinicHolidays");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "ClinicHolidays");

            migrationBuilder.DropColumn(
                name: "InternalNote",
                table: "ClinicHolidays");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "ClinicHolidays");

            migrationBuilder.DropColumn(
                name: "RecurringAnnually",
                table: "ClinicHolidays");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "ClinicHolidays");

            migrationBuilder.RenameColumn(
                name: "StartDate",
                table: "ClinicHolidays",
                newName: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_ClinicHours_ClinicId_DayOfWeek",
                table: "ClinicHours",
                columns: new[] { "ClinicId", "DayOfWeek" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClinicHolidays_ClinicId_Date",
                table: "ClinicHolidays",
                columns: new[] { "ClinicId", "Date" },
                unique: true);
        }
    }
}
