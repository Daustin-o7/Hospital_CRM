using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <summary>
    /// Data-only migration. Credit notes issued before dual control existed were all approved
    /// immediately (ledger posted, balance reduced), but the new Status column defaults to 0
    /// (PendingApproval). Mark those historical rows Approved and record the original approver
    /// as the second approver, otherwise they would be counted as "not yet credited" and could
    /// be re-issued against an invoice.
    /// </summary>
    public partial class Section5CreditNoteStatusBackfill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Only flip rows whose reversal was actually posted to the ledger; a note still sitting
            // in PendingApproval (no ledger entry) keeps pending status and stays uncredited.
            migrationBuilder.Sql(
                """
                UPDATE "CreditNotes" cn
                SET "Status" = 1, "SecondApprovedByUserId" = cn."ApprovedByUserId"
                WHERE cn."Status" = 0
                  AND EXISTS (
                      SELECT 1 FROM "FinanceLedgerEntries" e
                      WHERE e."ReferenceId" = cn."Id" AND e."ReferenceType" = 'CreditNote');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE "CreditNotes"
                SET "Status" = 0, "SecondApprovedByUserId" = NULL
                WHERE "Status" = 1 AND "SecondApprovedByUserId" = "ApprovedByUserId";
                """);
        }
    }
}
