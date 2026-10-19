using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hospital_CRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MapLegacySubscriptionTierToStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A4.1 Data Migration: Map legacy SubscriptionTier.Trial (0) and SubscriptionTier.Suspended (99)
            // into SubscriptionStatus without losing data, normalizing Tier to Starter (1) per Decision D5.
            migrationBuilder.Sql(@"
                -- Map legacy Trial tier (0) to Status Trial (0) and Tier Starter (1)
                UPDATE ""Tenants""
                SET ""SubscriptionStatus"" = 0, ""SubscriptionTier"" = 1
                WHERE ""SubscriptionTier"" = 0;

                UPDATE ""Clinics""
                SET ""SubscriptionStatus"" = 0, ""SubscriptionTier"" = 1
                WHERE ""SubscriptionTier"" = 0;

                -- Map legacy Suspended tier (99) to Status Suspended (3) and Tier Starter (1)
                UPDATE ""Tenants""
                SET ""SubscriptionStatus"" = 3, ""SubscriptionTier"" = 1
                WHERE ""SubscriptionTier"" = 99;

                UPDATE ""Clinics""
                SET ""SubscriptionStatus"" = 3, ""SubscriptionTier"" = 1
                WHERE ""SubscriptionTier"" = 99;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                -- Revert Starter tenants with Trial status back to legacy Trial tier
                UPDATE ""Tenants""
                SET ""SubscriptionTier"" = 0
                WHERE ""SubscriptionStatus"" = 0 AND ""SubscriptionTier"" = 1;

                UPDATE ""Clinics""
                SET ""SubscriptionTier"" = 0
                WHERE ""SubscriptionStatus"" = 0 AND ""SubscriptionTier"" = 1;

                -- Revert Starter tenants with Suspended status back to legacy Suspended tier
                UPDATE ""Tenants""
                SET ""SubscriptionTier"" = 99
                WHERE ""SubscriptionStatus"" = 3 AND ""SubscriptionTier"" = 1;

                UPDATE ""Clinics""
                SET ""SubscriptionTier"" = 99
                WHERE ""SubscriptionStatus"" = 3 AND ""SubscriptionTier"" = 1;
            ");
        }
    }
}
