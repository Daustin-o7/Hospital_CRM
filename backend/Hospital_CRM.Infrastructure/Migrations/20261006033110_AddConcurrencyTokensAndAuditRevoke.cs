using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddConcurrencyTokensAndAuditRevoke : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "Patients",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AlterColumn<Guid>(
                name: "DepartmentId",
                table: "NurseProfiles",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "Invoices",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "DrugBatches",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()",
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "DrugBatches",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "Appointments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "now()");

            // FR-08: Append-only audit enforcement at PostgreSQL role level across all audit tables
            migrationBuilder.Sql(@"
DO $$
BEGIN
    CREATE ROLE app_user;
EXCEPTION WHEN duplicate_object THEN null;
END $$;");

            migrationBuilder.Sql("REVOKE UPDATE, DELETE ON \"PatientAuditLogs\" FROM app_user;");
            migrationBuilder.Sql("REVOKE UPDATE, DELETE ON \"NurseAuditLogs\" FROM app_user;");
            migrationBuilder.Sql("REVOKE UPDATE, DELETE ON \"NotificationLogs\" FROM app_user;");
            migrationBuilder.Sql("REVOKE UPDATE, DELETE ON \"PriorityLogs\" FROM app_user;");
            migrationBuilder.Sql("REVOKE UPDATE, DELETE ON \"ImpersonationLogs\" FROM app_user;");
            migrationBuilder.Sql("REVOKE UPDATE, DELETE ON \"AppointmentHistories\" FROM app_user;");
            migrationBuilder.Sql("REVOKE UPDATE, DELETE ON \"ControlledSubstanceRegisters\" FROM app_user;");

            migrationBuilder.Sql("GRANT INSERT, SELECT ON \"PatientAuditLogs\" TO app_user;");
            migrationBuilder.Sql("GRANT INSERT, SELECT ON \"NurseAuditLogs\" TO app_user;");
            migrationBuilder.Sql("GRANT INSERT, SELECT ON \"NotificationLogs\" TO app_user;");
            migrationBuilder.Sql("GRANT INSERT, SELECT ON \"PriorityLogs\" TO app_user;");
            migrationBuilder.Sql("GRANT INSERT, SELECT ON \"ImpersonationLogs\" TO app_user;");
            migrationBuilder.Sql("GRANT INSERT, SELECT ON \"AppointmentHistories\" TO app_user;");
            migrationBuilder.Sql("GRANT INSERT, SELECT ON \"ControlledSubstanceRegisters\" TO app_user;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Patients");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "DrugBatches");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Appointments");

            migrationBuilder.AlterColumn<Guid>(
                name: "DepartmentId",
                table: "NurseProfiles",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "DrugBatches",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldDefaultValueSql: "now()");
        }
    }
}
