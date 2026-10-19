using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BackfillTenantIdToActiveTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DO $$
DECLARE
    v_tenant_id uuid;
BEGIN
    SELECT ""Id"" INTO v_tenant_id FROM ""Tenants"" LIMIT 1;
    IF v_tenant_id IS NOT NULL THEN
        UPDATE ""Patients"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""DrugBatches"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""LeaveRequests"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""NurseShiftApplications"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""NurseShifts"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""LedgerExpenses"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""Drugs"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""Invoices"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""Appointments"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""InventoryItems"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""MessageTemplates"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""NotificationRules"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""ConsultTemplates"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""WishlistItems"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""Suppliers"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""PurchaseOrders"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""ControlledSubstanceRegisters"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""DispenseRecords"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""Departments"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""ShiftHandovers"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""PatientNurseAssignments"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""NurseAvailabilities"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""NurseProfiles"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""PrecheckSubmissions"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""StockMovements"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""StaffInvites"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
        UPDATE ""TenantFeatureFlags"" SET ""TenantId"" = v_tenant_id WHERE ""TenantId"" = '00000000-0000-0000-0000-000000000000';
    END IF;
END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
