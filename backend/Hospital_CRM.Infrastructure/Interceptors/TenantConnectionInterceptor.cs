using System.Data.Common;
using Hospital_CRM.Domain.Services;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Hospital_CRM.Infrastructure.Interceptors;

/// <summary>
/// RLS session scope. The connection-level SET gives every statement on the
/// connection a tenant; TransactionStarted re-applies it with SET LOCAL so an
/// explicit transaction is self-describing and cannot inherit a pooled
/// connection's previous tenant.
/// </summary>
public class TenantConnectionInterceptor : DbConnectionInterceptor, IDbTransactionInterceptor
{
    private readonly ITenantContext? _tenantContext;

    public TenantConnectionInterceptor(ITenantContext? tenantContext = null)
    {
        _tenantContext = tenantContext;
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        Apply(connection, scoped: false);
        base.ConnectionOpened(connection, eventData);
    }

    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        if (CanApply(connection))
        {
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = TenantSql(scoped: false);
            await cmd.ExecuteNonQueryAsync(cancellationToken);
        }
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }

    public void TransactionStarted(DbTransaction transaction, TransactionEndEventData eventData) =>
        Apply(transaction.Connection, scoped: true);

    public Task TransactionStartedAsync(DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        Apply(transaction.Connection, scoped: true);
        return Task.CompletedTask;
    }

    /// <summary>
    /// SET LOCAL must run inside a transaction; outside one it would be discarded by
    /// the implicit per-statement transaction. Hence the connection-level SET, which
    /// is re-issued on every ConnectionOpened so a pooled connection cannot carry the
    /// previous tenant into the next request.
    /// </summary>
    private string TenantSql(bool scoped)
    {
        var tenantId = _tenantContext?.CurrentTenantId;
        var isAdmin = _tenantContext?.IsPlatformAdmin ?? false;
        var scope = scoped ? "LOCAL " : string.Empty;

        return $"SET {scope}app.current_tenant_id = '{(tenantId.HasValue ? tenantId.Value.ToString() : "")}'; " +
               $"SET {scope}app.is_platform_admin = '{(isAdmin ? "true" : "false")}';";
    }

    private void Apply(DbConnection? connection, bool scoped)
    {
        if (!CanApply(connection))
            return;

        using var cmd = connection!.CreateCommand();
        cmd.CommandText = TenantSql(scoped);
        cmd.ExecuteNonQuery();
    }

    private static bool CanApply(DbConnection? connection) =>
        connection is not null
        && connection.State == System.Data.ConnectionState.Open
        && connection.GetType().Name.Contains("Npgsql", StringComparison.OrdinalIgnoreCase);
}
