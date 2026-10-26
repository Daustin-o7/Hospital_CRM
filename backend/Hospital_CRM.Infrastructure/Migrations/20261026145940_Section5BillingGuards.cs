using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Section5BillingGuards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Invoices_TenantId_FinancialYear_Series_InvoiceNumber",
                table: "Invoices",
                columns: new[] { "TenantId", "FinancialYear", "Series", "InvoiceNumber" },
                unique: true,
                filter: "\"InvoiceNumber\" > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Invoices_TenantId_FinancialYear_Series_InvoiceNumber",
                table: "Invoices");
        }
    }
}
