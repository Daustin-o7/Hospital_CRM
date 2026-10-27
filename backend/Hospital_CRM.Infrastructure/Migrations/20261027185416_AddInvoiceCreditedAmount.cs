using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceCreditedAmount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CreditedAmount",
                table: "Invoices",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            // Existing approved credit notes must be carried over, or the next balance recompute re-bills them.
            migrationBuilder.Sql(@"
                UPDATE ""Invoices"" AS i
                SET ""CreditedAmount"" = COALESCE((
                    SELECT SUM(c.""Amount"") FROM ""CreditNotes"" AS c
                    WHERE c.""InvoiceId"" = i.""Id"" AND c.""Status"" = 1), 0);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreditedAmount",
                table: "Invoices");
        }
    }
}
