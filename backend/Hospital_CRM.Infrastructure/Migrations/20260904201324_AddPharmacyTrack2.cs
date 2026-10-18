using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPharmacyTrack2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Appointments_AppointmentId",
                table: "Invoices");

            migrationBuilder.DropTable(
                name: "WishlistItems");

            migrationBuilder.AddColumn<string>(
                name: "Reason",
                table: "PriorityLogs",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "AppointmentId",
                table: "Invoices",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<int>(
                name: "InvoiceType",
                table: "Invoices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "PatientId",
                table: "Invoices",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WalkInCustomerName",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WalkInCustomerPhone",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DrugBatchId",
                table: "InvoiceLineItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "GstRate",
                table: "InvoiceLineItems",
                type: "numeric(5,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "HsnCode",
                table: "InvoiceLineItems",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "InvoiceLineItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "UnitPrice",
                table: "InvoiceLineItems",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "DispenseRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PrescriptionId = table.Column<Guid>(type: "uuid", nullable: true),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    WalkInCustomerName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    DispensedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    DispensedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DispenseRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DispenseRecords_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_DispenseRecords_Prescriptions_PrescriptionId",
                        column: x => x.PrescriptionId,
                        principalTable: "Prescriptions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_DispenseRecords_Users_DispensedBy",
                        column: x => x.DispensedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Drugs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    GenericName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    TherapeuticCategory = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DosageForm = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Strength = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ScheduleClass = table.Column<int>(type: "integer", nullable: false),
                    HsnCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    GstRate = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    NlemCovered = table.Column<bool>(type: "boolean", nullable: false),
                    DpcoCeilingPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    StandardPackSize = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IndicativeMrp = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CommonBrands = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Drugs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Gstin = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ControlledSubstanceRegisters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    DispenseRecordId = table.Column<Guid>(type: "uuid", nullable: true),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    DrugId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduleClass = table.Column<int>(type: "integer", nullable: false),
                    DrugName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    BatchNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    PatientName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    PatientAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    PrescriberName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    PrescriberRegNo = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DispensedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    DispenserName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    DispensedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ControlledSubstanceRegisters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ControlledSubstanceRegisters_DispenseRecords_DispenseRecord~",
                        column: x => x.DispenseRecordId,
                        principalTable: "DispenseRecords",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ControlledSubstanceRegisters_Drugs_DrugId",
                        column: x => x.DrugId,
                        principalTable: "Drugs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ControlledSubstanceRegisters_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "DrugBatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    DrugId = table.Column<Guid>(type: "uuid", nullable: false),
                    BatchNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExpiryDate = table.Column<DateOnly>(type: "date", nullable: false),
                    MfgDate = table.Column<DateOnly>(type: "date", nullable: true),
                    QuantityReceived = table.Column<int>(type: "integer", nullable: false),
                    QuantityRemaining = table.Column<int>(type: "integer", nullable: false),
                    Mrp = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PurchaseRate = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SupplierId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DrugBatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DrugBatches_Drugs_DrugId",
                        column: x => x.DrugId,
                        principalTable: "Drugs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DrugBatches_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PurchaseOrders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    SupplierId = table.Column<Guid>(type: "uuid", nullable: true),
                    DistributorName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    OrderNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ItemsJson = table.Column<string>(type: "jsonb", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseOrders_Suppliers_SupplierId",
                        column: x => x.SupplierId,
                        principalTable: "Suppliers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PurchaseOrders_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DispenseItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DispenseRecordId = table.Column<Guid>(type: "uuid", nullable: false),
                    PrescriptionItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    DrugBatchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DispenseItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DispenseItems_DispenseRecords_DispenseRecordId",
                        column: x => x.DispenseRecordId,
                        principalTable: "DispenseRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DispenseItems_DrugBatches_DrugBatchId",
                        column: x => x.DrugBatchId,
                        principalTable: "DrugBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DispenseItems_PrescriptionItems_PrescriptionItemId",
                        column: x => x.PrescriptionItemId,
                        principalTable: "PrescriptionItems",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_PatientId",
                table: "Invoices",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceLineItems_DrugBatchId",
                table: "InvoiceLineItems",
                column: "DrugBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ControlledSubstanceRegisters_DispenseRecordId",
                table: "ControlledSubstanceRegisters",
                column: "DispenseRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_ControlledSubstanceRegisters_DrugId",
                table: "ControlledSubstanceRegisters",
                column: "DrugId");

            migrationBuilder.CreateIndex(
                name: "IX_ControlledSubstanceRegisters_InvoiceId",
                table: "ControlledSubstanceRegisters",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_ControlledSubstanceRegisters_TenantId_ScheduleClass_Dispens~",
                table: "ControlledSubstanceRegisters",
                columns: new[] { "TenantId", "ScheduleClass", "DispensedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DispenseItems_DispenseRecordId",
                table: "DispenseItems",
                column: "DispenseRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_DispenseItems_DrugBatchId",
                table: "DispenseItems",
                column: "DrugBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_DispenseItems_PrescriptionItemId",
                table: "DispenseItems",
                column: "PrescriptionItemId");

            migrationBuilder.CreateIndex(
                name: "IX_DispenseRecords_DispensedBy",
                table: "DispenseRecords",
                column: "DispensedBy");

            migrationBuilder.CreateIndex(
                name: "IX_DispenseRecords_PatientId",
                table: "DispenseRecords",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_DispenseRecords_PrescriptionId",
                table: "DispenseRecords",
                column: "PrescriptionId");

            migrationBuilder.CreateIndex(
                name: "IX_DispenseRecords_TenantId_DispensedAt",
                table: "DispenseRecords",
                columns: new[] { "TenantId", "DispensedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DrugBatches_BatchNumber",
                table: "DrugBatches",
                column: "BatchNumber");

            migrationBuilder.CreateIndex(
                name: "IX_DrugBatches_DrugId_ExpiryDate",
                table: "DrugBatches",
                columns: new[] { "DrugId", "ExpiryDate" });

            migrationBuilder.CreateIndex(
                name: "IX_DrugBatches_SupplierId",
                table: "DrugBatches",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_Drugs_GenericName",
                table: "Drugs",
                column: "GenericName");

            migrationBuilder.CreateIndex(
                name: "IX_Drugs_ScheduleClass",
                table: "Drugs",
                column: "ScheduleClass");

            migrationBuilder.CreateIndex(
                name: "IX_Drugs_TenantId_Name",
                table: "Drugs",
                columns: new[] { "TenantId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_CreatedBy",
                table: "PurchaseOrders",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_SupplierId",
                table: "PurchaseOrders",
                column: "SupplierId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_TenantId_CreatedAt",
                table: "PurchaseOrders",
                columns: new[] { "TenantId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_TenantId_Name",
                table: "Suppliers",
                columns: new[] { "TenantId", "Name" });

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceLineItems_DrugBatches_DrugBatchId",
                table: "InvoiceLineItems",
                column: "DrugBatchId",
                principalTable: "DrugBatches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Appointments_AppointmentId",
                table: "Invoices",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Patients_PatientId",
                table: "Invoices",
                column: "PatientId",
                principalTable: "Patients",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceLineItems_DrugBatches_DrugBatchId",
                table: "InvoiceLineItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Appointments_AppointmentId",
                table: "Invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Patients_PatientId",
                table: "Invoices");

            migrationBuilder.DropTable(
                name: "ControlledSubstanceRegisters");

            migrationBuilder.DropTable(
                name: "DispenseItems");

            migrationBuilder.DropTable(
                name: "PurchaseOrders");

            migrationBuilder.DropTable(
                name: "DispenseRecords");

            migrationBuilder.DropTable(
                name: "DrugBatches");

            migrationBuilder.DropTable(
                name: "Drugs");

            migrationBuilder.DropTable(
                name: "Suppliers");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_PatientId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_InvoiceLineItems_DrugBatchId",
                table: "InvoiceLineItems");

            migrationBuilder.DropColumn(
                name: "Reason",
                table: "PriorityLogs");

            migrationBuilder.DropColumn(
                name: "InvoiceType",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "PatientId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "WalkInCustomerName",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "WalkInCustomerPhone",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "DrugBatchId",
                table: "InvoiceLineItems");

            migrationBuilder.DropColumn(
                name: "GstRate",
                table: "InvoiceLineItems");

            migrationBuilder.DropColumn(
                name: "HsnCode",
                table: "InvoiceLineItems");

            migrationBuilder.DropColumn(
                name: "Quantity",
                table: "InvoiceLineItems");

            migrationBuilder.DropColumn(
                name: "UnitPrice",
                table: "InvoiceLineItems");

            migrationBuilder.AlterColumn<Guid>(
                name: "AppointmentId",
                table: "Invoices",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "WishlistItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WishlistItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WishlistItems_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WishlistItems_CreatedBy",
                table: "WishlistItems",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_WishlistItems_TenantId_Status",
                table: "WishlistItems",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Appointments_AppointmentId",
                table: "Invoices",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
