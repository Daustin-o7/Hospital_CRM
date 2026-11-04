using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGoLiveCompositeIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Patients_TenantId_Phone",
                table: "Patients",
                columns: new[] { "TenantId", "Phone" });

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_TenantId_PatientId_Status",
                table: "Invoices",
                columns: new[] { "TenantId", "PatientId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_DrugBatches_DrugId_ExpiryDate_QuantityRemaining",
                table: "DrugBatches",
                columns: new[] { "DrugId", "ExpiryDate", "QuantityRemaining" });

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_TenantId_AppointmentId_CreatedAt",
                table: "Consultations",
                columns: new[] { "TenantId", "AppointmentId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_TenantId_DoctorId_Date_Status",
                table: "Appointments",
                columns: new[] { "TenantId", "DoctorId", "Date", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Patients_TenantId_Phone",
                table: "Patients");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_TenantId_PatientId_Status",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_DrugBatches_DrugId_ExpiryDate_QuantityRemaining",
                table: "DrugBatches");

            migrationBuilder.DropIndex(
                name: "IX_Consultations_TenantId_AppointmentId_CreatedAt",
                table: "Consultations");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_TenantId_DoctorId_Date_Status",
                table: "Appointments");
        }
    }
}
