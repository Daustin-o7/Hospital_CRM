using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Section4PharmacyHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ControlledSubstanceRegisters_DispenseRecords_DispenseRecord~",
                table: "ControlledSubstanceRegisters");

            migrationBuilder.DropForeignKey(
                name: "FK_ControlledSubstanceRegisters_Drugs_DrugId",
                table: "ControlledSubstanceRegisters");

            migrationBuilder.DropForeignKey(
                name: "FK_ControlledSubstanceRegisters_Invoices_InvoiceId",
                table: "ControlledSubstanceRegisters");

            migrationBuilder.DropForeignKey(
                name: "FK_DispenseItems_DispenseRecords_DispenseRecordId",
                table: "DispenseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_DispenseItems_DrugBatches_DrugBatchId",
                table: "DispenseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_DispenseItems_PrescriptionItems_PrescriptionItemId",
                table: "DispenseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_DrugStockMovements_DrugBatches_DrugBatchId",
                table: "DrugStockMovements");

            migrationBuilder.DropForeignKey(
                name: "FK_DrugStockMovements_Drugs_DrugId",
                table: "DrugStockMovements");

            migrationBuilder.DropForeignKey(
                name: "FK_DrugStockMovements_Users_RecordedBy",
                table: "DrugStockMovements");

            migrationBuilder.DropForeignKey(
                name: "FK_MedicineSearchMissLogs_Users_SearchedByUserId",
                table: "MedicineSearchMissLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_PrescriptionPrintLogs_Consultations_ConsultationId",
                table: "PrescriptionPrintLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_PrescriptionPrintLogs_Prescriptions_PrescriptionId",
                table: "PrescriptionPrintLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_PrescriptionPrintLogs_Users_PrintedByUserId",
                table: "PrescriptionPrintLogs");

            migrationBuilder.AddColumn<DateOnly>(
                name: "InvoiceDate",
                table: "DrugBatches",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SupplierLicenceNumber",
                table: "DrugBatches",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DispenseRecords_TenantId_IdempotencyKey",
                table: "DispenseRecords",
                columns: new[] { "TenantId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_ControlledSubstanceRegisters_DispenseRecords_DispenseRecord~",
                table: "ControlledSubstanceRegisters",
                column: "DispenseRecordId",
                principalTable: "DispenseRecords",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ControlledSubstanceRegisters_Drugs_DrugId",
                table: "ControlledSubstanceRegisters",
                column: "DrugId",
                principalTable: "Drugs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ControlledSubstanceRegisters_Invoices_InvoiceId",
                table: "ControlledSubstanceRegisters",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DispenseItems_DispenseRecords_DispenseRecordId",
                table: "DispenseItems",
                column: "DispenseRecordId",
                principalTable: "DispenseRecords",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DispenseItems_DrugBatches_DrugBatchId",
                table: "DispenseItems",
                column: "DrugBatchId",
                principalTable: "DrugBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DispenseItems_PrescriptionItems_PrescriptionItemId",
                table: "DispenseItems",
                column: "PrescriptionItemId",
                principalTable: "PrescriptionItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DrugStockMovements_DrugBatches_DrugBatchId",
                table: "DrugStockMovements",
                column: "DrugBatchId",
                principalTable: "DrugBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DrugStockMovements_Drugs_DrugId",
                table: "DrugStockMovements",
                column: "DrugId",
                principalTable: "Drugs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DrugStockMovements_Users_RecordedBy",
                table: "DrugStockMovements",
                column: "RecordedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_MedicineSearchMissLogs_Users_SearchedByUserId",
                table: "MedicineSearchMissLogs",
                column: "SearchedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PrescriptionPrintLogs_Consultations_ConsultationId",
                table: "PrescriptionPrintLogs",
                column: "ConsultationId",
                principalTable: "Consultations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PrescriptionPrintLogs_Prescriptions_PrescriptionId",
                table: "PrescriptionPrintLogs",
                column: "PrescriptionId",
                principalTable: "Prescriptions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PrescriptionPrintLogs_Users_PrintedByUserId",
                table: "PrescriptionPrintLogs",
                column: "PrintedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ControlledSubstanceRegisters_DispenseRecords_DispenseRecord~",
                table: "ControlledSubstanceRegisters");

            migrationBuilder.DropForeignKey(
                name: "FK_ControlledSubstanceRegisters_Drugs_DrugId",
                table: "ControlledSubstanceRegisters");

            migrationBuilder.DropForeignKey(
                name: "FK_ControlledSubstanceRegisters_Invoices_InvoiceId",
                table: "ControlledSubstanceRegisters");

            migrationBuilder.DropForeignKey(
                name: "FK_DispenseItems_DispenseRecords_DispenseRecordId",
                table: "DispenseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_DispenseItems_DrugBatches_DrugBatchId",
                table: "DispenseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_DispenseItems_PrescriptionItems_PrescriptionItemId",
                table: "DispenseItems");

            migrationBuilder.DropForeignKey(
                name: "FK_DrugStockMovements_DrugBatches_DrugBatchId",
                table: "DrugStockMovements");

            migrationBuilder.DropForeignKey(
                name: "FK_DrugStockMovements_Drugs_DrugId",
                table: "DrugStockMovements");

            migrationBuilder.DropForeignKey(
                name: "FK_DrugStockMovements_Users_RecordedBy",
                table: "DrugStockMovements");

            migrationBuilder.DropForeignKey(
                name: "FK_MedicineSearchMissLogs_Users_SearchedByUserId",
                table: "MedicineSearchMissLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_PrescriptionPrintLogs_Consultations_ConsultationId",
                table: "PrescriptionPrintLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_PrescriptionPrintLogs_Prescriptions_PrescriptionId",
                table: "PrescriptionPrintLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_PrescriptionPrintLogs_Users_PrintedByUserId",
                table: "PrescriptionPrintLogs");

            migrationBuilder.DropIndex(
                name: "IX_DispenseRecords_TenantId_IdempotencyKey",
                table: "DispenseRecords");

            migrationBuilder.DropColumn(
                name: "InvoiceDate",
                table: "DrugBatches");

            migrationBuilder.DropColumn(
                name: "SupplierLicenceNumber",
                table: "DrugBatches");

            migrationBuilder.AddForeignKey(
                name: "FK_ControlledSubstanceRegisters_DispenseRecords_DispenseRecord~",
                table: "ControlledSubstanceRegisters",
                column: "DispenseRecordId",
                principalTable: "DispenseRecords",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ControlledSubstanceRegisters_Drugs_DrugId",
                table: "ControlledSubstanceRegisters",
                column: "DrugId",
                principalTable: "Drugs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ControlledSubstanceRegisters_Invoices_InvoiceId",
                table: "ControlledSubstanceRegisters",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DispenseItems_DispenseRecords_DispenseRecordId",
                table: "DispenseItems",
                column: "DispenseRecordId",
                principalTable: "DispenseRecords",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DispenseItems_DrugBatches_DrugBatchId",
                table: "DispenseItems",
                column: "DrugBatchId",
                principalTable: "DrugBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DispenseItems_PrescriptionItems_PrescriptionItemId",
                table: "DispenseItems",
                column: "PrescriptionItemId",
                principalTable: "PrescriptionItems",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DrugStockMovements_DrugBatches_DrugBatchId",
                table: "DrugStockMovements",
                column: "DrugBatchId",
                principalTable: "DrugBatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DrugStockMovements_Drugs_DrugId",
                table: "DrugStockMovements",
                column: "DrugId",
                principalTable: "Drugs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_DrugStockMovements_Users_RecordedBy",
                table: "DrugStockMovements",
                column: "RecordedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MedicineSearchMissLogs_Users_SearchedByUserId",
                table: "MedicineSearchMissLogs",
                column: "SearchedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PrescriptionPrintLogs_Consultations_ConsultationId",
                table: "PrescriptionPrintLogs",
                column: "ConsultationId",
                principalTable: "Consultations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PrescriptionPrintLogs_Prescriptions_PrescriptionId",
                table: "PrescriptionPrintLogs",
                column: "PrescriptionId",
                principalTable: "Prescriptions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PrescriptionPrintLogs_Users_PrintedByUserId",
                table: "PrescriptionPrintLogs",
                column: "PrintedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
