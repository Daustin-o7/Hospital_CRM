using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Section4PharmacyLedgerAndExternalRx : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DispensedBatchId",
                table: "PrescriptionItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DispensedQuantity",
                table: "PrescriptionItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "SubstitutedDrugId",
                table: "PrescriptionItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubstitutionReason",
                table: "PrescriptionItems",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DataSource",
                table: "Drugs",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ExternalCode",
                table: "Drugs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsUnverified",
                table: "Drugs",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "BaseUnitQuantity",
                table: "DrugBatches",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "DrugBatches",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRecalled",
                table: "DrugBatches",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PackSize",
                table: "DrugBatches",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecallReason",
                table: "DrugBatches",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PharmacyGstNumber",
                table: "Clinics",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PharmacyLicenceNumber20",
                table: "Clinics",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PharmacyLicenceNumber21",
                table: "Clinics",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DrugStockMovements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    DrugId = table.Column<Guid>(type: "uuid", nullable: false),
                    DrugBatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    Direction = table.Column<int>(type: "integer", nullable: false),
                    ReferenceType = table.Column<string>(type: "text", nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Note = table.Column<string>(type: "text", nullable: true),
                    RecordedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    RecordedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DrugStockMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DrugStockMovements_DrugBatches_DrugBatchId",
                        column: x => x.DrugBatchId,
                        principalTable: "DrugBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DrugStockMovements_Drugs_DrugId",
                        column: x => x.DrugId,
                        principalTable: "Drugs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DrugStockMovements_Users_RecordedBy",
                        column: x => x.RecordedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MedicineSearchMissLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Query = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    SearchedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SearchedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MedicineSearchMissLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MedicineSearchMissLogs_Users_SearchedByUserId",
                        column: x => x.SearchedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PrescriptionPrintLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultationId = table.Column<Guid>(type: "uuid", nullable: false),
                    PrescriptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    PrintCount = table.Column<int>(type: "integer", nullable: false),
                    IsDuplicateCopy = table.Column<bool>(type: "boolean", nullable: false),
                    PrintedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PrintedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrescriptionPrintLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PrescriptionPrintLogs_Consultations_ConsultationId",
                        column: x => x.ConsultationId,
                        principalTable: "Consultations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PrescriptionPrintLogs_Prescriptions_PrescriptionId",
                        column: x => x.PrescriptionId,
                        principalTable: "Prescriptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PrescriptionPrintLogs_Users_PrintedByUserId",
                        column: x => x.PrintedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_DrugBatch_QuantityRemaining_NonNegative",
                table: "DrugBatches",
                sql: "\"QuantityRemaining\" >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_DrugStockMovements_DrugBatchId",
                table: "DrugStockMovements",
                column: "DrugBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_DrugStockMovements_DrugId",
                table: "DrugStockMovements",
                column: "DrugId");

            migrationBuilder.CreateIndex(
                name: "IX_DrugStockMovements_RecordedBy",
                table: "DrugStockMovements",
                column: "RecordedBy");

            migrationBuilder.CreateIndex(
                name: "IX_DrugStockMovements_TenantId_DrugBatchId",
                table: "DrugStockMovements",
                columns: new[] { "TenantId", "DrugBatchId" });

            migrationBuilder.CreateIndex(
                name: "IX_DrugStockMovements_TenantId_RecordedAt",
                table: "DrugStockMovements",
                columns: new[] { "TenantId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MedicineSearchMissLogs_SearchedByUserId",
                table: "MedicineSearchMissLogs",
                column: "SearchedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MedicineSearchMissLogs_TenantId_SearchedAt",
                table: "MedicineSearchMissLogs",
                columns: new[] { "TenantId", "SearchedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PrescriptionPrintLogs_ConsultationId",
                table: "PrescriptionPrintLogs",
                column: "ConsultationId");

            migrationBuilder.CreateIndex(
                name: "IX_PrescriptionPrintLogs_PrescriptionId",
                table: "PrescriptionPrintLogs",
                column: "PrescriptionId");

            migrationBuilder.CreateIndex(
                name: "IX_PrescriptionPrintLogs_PrintedByUserId",
                table: "PrescriptionPrintLogs",
                column: "PrintedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PrescriptionPrintLogs_TenantId_PrescriptionId",
                table: "PrescriptionPrintLogs",
                columns: new[] { "TenantId", "PrescriptionId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DrugStockMovements");

            migrationBuilder.DropTable(
                name: "MedicineSearchMissLogs");

            migrationBuilder.DropTable(
                name: "PrescriptionPrintLogs");

            migrationBuilder.DropCheckConstraint(
                name: "CK_DrugBatch_QuantityRemaining_NonNegative",
                table: "DrugBatches");

            migrationBuilder.DropColumn(
                name: "DispensedBatchId",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "DispensedQuantity",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "SubstitutedDrugId",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "SubstitutionReason",
                table: "PrescriptionItems");

            migrationBuilder.DropColumn(
                name: "DataSource",
                table: "Drugs");

            migrationBuilder.DropColumn(
                name: "ExternalCode",
                table: "Drugs");

            migrationBuilder.DropColumn(
                name: "IsUnverified",
                table: "Drugs");

            migrationBuilder.DropColumn(
                name: "BaseUnitQuantity",
                table: "DrugBatches");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "DrugBatches");

            migrationBuilder.DropColumn(
                name: "IsRecalled",
                table: "DrugBatches");

            migrationBuilder.DropColumn(
                name: "PackSize",
                table: "DrugBatches");

            migrationBuilder.DropColumn(
                name: "RecallReason",
                table: "DrugBatches");

            migrationBuilder.DropColumn(
                name: "PharmacyGstNumber",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "PharmacyLicenceNumber20",
                table: "Clinics");

            migrationBuilder.DropColumn(
                name: "PharmacyLicenceNumber21",
                table: "Clinics");
        }
    }
}
