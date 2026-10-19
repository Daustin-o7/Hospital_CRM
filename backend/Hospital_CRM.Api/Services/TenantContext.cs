using System.Security.Claims;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Services;
using Microsoft.AspNetCore.Http;

namespace Hospital_CRM.Api.Services;

public class TenantContext : ITenantContext
{
    private readonly IHttpContextAccessor? _httpContextAccessor;
    private readonly AsyncLocal<Guid?> _explicitTenantId = new();

    public TenantContext(IHttpContextAccessor? httpContextAccessor = null)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid? CurrentTenantId
    {
        get
        {
            if (_explicitTenantId.Value.HasValue)
                return _explicitTenantId.Value;

            var user = _httpContextAccessor?.HttpContext?.User;
            return user?.GetTenantId();
        }
    }

    public bool IsPlatformAdmin
    {
        get
        {
            var httpContext = _httpContextAccessor?.HttpContext;
            if (httpContext == null)
            {
                // When running outside an HTTP request (e.g. startup migration, development seeding, CLI),
                // bypass tenant filtering unless an explicit tenant was pushed.
                return !_explicitTenantId.Value.HasValue;
            }

            var user = httpContext.User;
            var role = user?.GetUserRole();
            return string.Equals(role, "PlatformAdmin", StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>
    /// Explicitly scopes the tenant for background jobs, impersonation flows, or tests.
    /// Returns an IDisposable that restores previous tenant scope upon disposal.
    /// </summary>
    public IDisposable PushTenant(Guid tenantId)
    {
        var prior = _explicitTenantId.Value;
        _explicitTenantId.Value = tenantId;
        return new ActionDisposable(() => _explicitTenantId.Value = prior);
    }

    private sealed class ActionDisposable : IDisposable
    {
        private readonly Action _onDispose;
        private bool _disposed;

        public ActionDisposable(Action onDispose) => _onDispose = onDispose;

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                _onDispose();
            }
        }
    }
}
