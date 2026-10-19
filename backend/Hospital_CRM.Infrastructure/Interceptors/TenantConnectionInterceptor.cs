using System.Data.Common;
using Hospital_CRM.Domain.Services;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Hospital_CRM.Infrastructure.Interceptors;

public class TenantConnectionInterceptor : DbConnectionInterceptor
{
    private readonly ITenantContext? _tenantContext;

    public TenantConnectionInterceptor(ITenantContext? tenantContext = null)
    {
        _tenantContext = tenantContext;
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        SetTenantSession(connection);
        base.ConnectionOpened(connection, eventData);
    }

    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        await SetTenantSessionAsync(connection, cancellationToken);
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }

    private void SetTenantSession(DbConnection connection)
    {
        if (connection.State != System.Data.ConnectionState.Open)
            return;

        // Only PostgreSQL (Npgsql) supports custom variable classes via SET app.*
        if (!connection.GetType().Name.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
            return;

        var tenantId = _tenantContext?.CurrentTenantId;
        var isAdmin = _tenantContext?.IsPlatformAdmin ?? false;

        using var cmd = connection.CreateCommand();
        cmd.CommandText = $"SET app.current_tenant_id = '{(tenantId.HasValue ? tenantId.Value.ToString() : "")}'; SET app.is_platform_admin = '{(isAdmin ? "true" : "false")}';";
        cmd.ExecuteNonQuery();
    }

    private async Task SetTenantSessionAsync(DbConnection connection, CancellationToken ct)
    {
        if (connection.State != System.Data.ConnectionState.Open)
            return;

        if (!connection.GetType().Name.Contains("Npgsql", StringComparison.OrdinalIgnoreCase))
            return;

        var tenantId = _tenantContext?.CurrentTenantId;
        var isAdmin = _tenantContext?.IsPlatformAdmin ?? false;

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = $"SET app.current_tenant_id = '{(tenantId.HasValue ? tenantId.Value.ToString() : "")}'; SET app.is_platform_admin = '{(isAdmin ? "true" : "false")}';";
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
