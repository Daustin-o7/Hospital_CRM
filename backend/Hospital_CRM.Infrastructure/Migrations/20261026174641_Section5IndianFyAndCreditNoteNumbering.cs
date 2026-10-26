using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Section5IndianFyAndCreditNoteNumbering : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FinancialYear",
                table: "CreditNotes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "SequenceNumber",
                table: "CreditNotes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Series",
                table: "CreditNotes",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_CreditNotes_TenantId_FinancialYear_Series_SequenceNumber",
                table: "CreditNotes",
                columns: new[] { "TenantId", "FinancialYear", "Series", "SequenceNumber" },
                unique: true,
                filter: "\"SequenceNumber\" > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CreditNotes_TenantId_FinancialYear_Series_SequenceNumber",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "FinancialYear",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "SequenceNumber",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "Series",
                table: "CreditNotes");
        }
    }
}
