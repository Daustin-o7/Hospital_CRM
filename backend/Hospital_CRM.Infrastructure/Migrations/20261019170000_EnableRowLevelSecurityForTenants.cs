using System.Linq;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EnableRowLevelSecurityForTenants : Migration
    {
        private static readonly string[] TenantTables = new[]
        {
            "Patients",
            "Appointments",
            "Invoices",
            "Clinics",
            "Drugs",
            "DrugBatches",
            "InventoryItems",
            "LeaveRequests",
            "LedgerExpenses",
            "MessageTemplates",
            "NotificationRules",
            "NurseAvailabilities",
            "NurseProfiles",
            "NurseShifts",
            "NurseShiftApplications",
            "PatientNurseAssignments",
            "PurchaseOrders",
            "ShiftHandovers",
            "StockMovements",
            "Suppliers",
            "TenantFeatureFlags",
            "WishlistItems",
            "NurseAuditLogs",
            "ControlledSubstanceRegisters",
            "Departments",
            "DispenseRecords",
            "ConsultTemplates",
            "LabOrders"
        };

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var table in TenantTables)
            {
                migrationBuilder.Sql($@"
                    ALTER TABLE ""{table}"" ENABLE ROW LEVEL SECURITY;
                    DROP POLICY IF EXISTS tenant_isolation_policy ON ""{table}"";
                    CREATE POLICY tenant_isolation_policy ON ""{table}""
                    AS PERMISSIVE
                    FOR ALL
                    TO app_user
                    USING (
                        current_setting('app.is_platform_admin', true) = 'true'
                        OR ""TenantId"" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                    )
                    WITH CHECK (
                        current_setting('app.is_platform_admin', true) = 'true'
                        OR ""TenantId"" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                    );
                ");
            }

            // StaffInvites allows anonymous invite acceptance when unaccepted and unexpired
            migrationBuilder.Sql(@"
                ALTER TABLE ""StaffInvites"" ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_policy ON ""StaffInvites"";
                CREATE POLICY tenant_isolation_policy ON ""StaffInvites""
                AS PERMISSIVE
                FOR ALL
                TO app_user
                USING (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR ""TenantId"" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                    OR (""AcceptedAt"" IS NULL AND ""ExpiresAt"" > now())
                )
                WITH CHECK (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR ""TenantId"" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                );
            ");

            // PrecheckSubmissions allows unauthenticated patient precheck submission by token
            migrationBuilder.Sql(@"
                ALTER TABLE ""PrecheckSubmissions"" ENABLE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation_policy ON ""PrecheckSubmissions"";
                CREATE POLICY tenant_isolation_policy ON ""PrecheckSubmissions""
                AS PERMISSIVE
                FOR ALL
                TO app_user
                USING (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR ""TenantId"" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                    OR (""SubmittedAt"" IS NULL AND ""ExpiresAt"" > now())
                )
                WITH CHECK (
                    current_setting('app.is_platform_admin', true) = 'true'
                    OR ""TenantId"" = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                    OR (""SubmittedAt"" IS NOT NULL)
                );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            var allTables = TenantTables.Concat(new[] { "StaffInvites", "PrecheckSubmissions" });
            foreach (var table in allTables)
            {
                migrationBuilder.Sql($@"
                    DROP POLICY IF EXISTS tenant_isolation_policy ON ""{table}"";
                    ALTER TABLE ""{table}"" DISABLE ROW LEVEL SECURITY;
                ");
            }
        }
    }
}
