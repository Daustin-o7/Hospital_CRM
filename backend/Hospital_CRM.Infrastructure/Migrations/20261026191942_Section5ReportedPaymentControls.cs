using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Section5ReportedPaymentControls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MaxUnconfirmedReportedPaymentsAmount",
                table: "TenantTaxProfiles",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "MaxUnconfirmedReportedPaymentsCount",
                table: "TenantTaxProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "StaffConfirmationSpikeThreshold",
                table: "TenantTaxProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxUnconfirmedReportedPaymentsAmount",
                table: "TenantTaxProfiles");

            migrationBuilder.DropColumn(
                name: "MaxUnconfirmedReportedPaymentsCount",
                table: "TenantTaxProfiles");

            migrationBuilder.DropColumn(
                name: "StaffConfirmationSpikeThreshold",
                table: "TenantTaxProfiles");
        }
    }
}
