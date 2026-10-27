using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Section5PatientDepositsAndAdvances : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ThresholdCreditNoteApproval",
                table: "TenantTaxProfiles",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "SecondApprovedByUserId",
                table: "CreditNotes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "CreditNotes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "PatientDeposits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: true),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReceiptNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FinancialYear = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    SequenceNumber = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    AllocatedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    RefundedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Balance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Method = table.Column<int>(type: "integer", nullable: false),
                    ReferenceNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CollectedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PatientDeposits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PatientDeposits_Clinics_ClinicId",
                        column: x => x.ClinicId,
                        principalTable: "Clinics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PatientDeposits_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PatientDepositAllocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientDepositId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    AllocatedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    AllocatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AllocatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PatientDepositAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PatientDepositAllocations_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PatientDepositAllocations_PatientDeposits_PatientDepositId",
                        column: x => x.PatientDepositId,
                        principalTable: "PatientDeposits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CreditNotes_SecondApprovedByUserId",
                table: "CreditNotes",
                column: "SecondApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientDepositAllocations_InvoiceId",
                table: "PatientDepositAllocations",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientDepositAllocations_PatientDepositId",
                table: "PatientDepositAllocations",
                column: "PatientDepositId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientDepositAllocations_TenantId_InvoiceId",
                table: "PatientDepositAllocations",
                columns: new[] { "TenantId", "InvoiceId" });

            migrationBuilder.CreateIndex(
                name: "IX_PatientDepositAllocations_TenantId_PatientDepositId",
                table: "PatientDepositAllocations",
                columns: new[] { "TenantId", "PatientDepositId" });

            migrationBuilder.CreateIndex(
                name: "IX_PatientDeposits_ClinicId",
                table: "PatientDeposits",
                column: "ClinicId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientDeposits_PatientId",
                table: "PatientDeposits",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_PatientDeposits_TenantId_FinancialYear_SequenceNumber",
                table: "PatientDeposits",
                columns: new[] { "TenantId", "FinancialYear", "SequenceNumber" },
                unique: true,
                filter: "\"SequenceNumber\" > 0");

            migrationBuilder.CreateIndex(
                name: "IX_PatientDeposits_TenantId_PatientId_Status",
                table: "PatientDeposits",
                columns: new[] { "TenantId", "PatientId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PatientDeposits_TenantId_ReceiptNumber",
                table: "PatientDeposits",
                columns: new[] { "TenantId", "ReceiptNumber" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_CreditNotes_Users_SecondApprovedByUserId",
                table: "CreditNotes",
                column: "SecondApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CreditNotes_Users_SecondApprovedByUserId",
                table: "CreditNotes");

            migrationBuilder.DropTable(
                name: "PatientDepositAllocations");

            migrationBuilder.DropTable(
                name: "PatientDeposits");

            migrationBuilder.DropIndex(
                name: "IX_CreditNotes_SecondApprovedByUserId",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "ThresholdCreditNoteApproval",
                table: "TenantTaxProfiles");

            migrationBuilder.DropColumn(
                name: "SecondApprovedByUserId",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "CreditNotes");
        }
    }
}
