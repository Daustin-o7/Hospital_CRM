using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Services;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Middlewares;

/// <summary>
/// A4.3: Request middleware enforcing subscription lifecycle state per Decision D3 / D5.
/// - ReadOnly: rejects non-safe methods (POST, PUT, PATCH, DELETE) with HTTP 403 subscription_read_only.
/// - Blocked: rejects all non-exempt requests with HTTP 403 tenant_suspended.
/// Exemptions:
/// - PlatformAdmin users and /api/v1/platform-admin routes.
/// - Authentication routes (/api/v1/auth/*).
/// - Payment webhooks & gateways (reconciliation of money in flight).
/// - Data export routes (per A4.4 / D3).
/// - Health checks and API documentation.
/// </summary>
public class SubscriptionEnforcementMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SubscriptionEnforcementMiddleware> _logger;

    public SubscriptionEnforcementMiddleware(
        RequestDelegate next,
        ILogger<SubscriptionEnforcementMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, HospitalCrmDbContext db)
    {
        var user = context.User;

        // Unauthenticated requests pass to authentication handler
        if (user?.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        // Platform Admin is always exempt (directly or via support impersonation session)
        if (user.IsInRole("PlatformAdmin") || user.HasClaim(c => c.Type == "impersonated_by"))
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path.Value ?? string.Empty;

        // Exempt routes
        if (IsExemptPath(path))
        {
            await _next(context);
            return;
        }

        var tenantId = user.GetTenantId();
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            await _next(context);
            return;
        }

        // Single indexed lookup per request
        var tenant = await db.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId.Value)
            .Select(t => new { t.SubscriptionStatus, t.SubscriptionEndsAt })
            .FirstOrDefaultAsync(context.RequestAborted);

        if (tenant is null)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "tenant_not_found",
                message = "Tenant does not exist."
            });
            return;
        }

        var effectiveAccess = SubscriptionPolicy.EffectiveAccess(
            tenant.SubscriptionStatus,
            tenant.SubscriptionEndsAt,
            DateTimeOffset.UtcNow);

        if (effectiveAccess == EffectiveAccessLevel.Blocked)
        {
            _logger.LogWarning("Request blocked for suspended tenant {TenantId} on {Method} {Path}",
                tenantId.Value, context.Request.Method, path);

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "tenant_suspended",
                message = "Tenant access is blocked due to subscription suspension."
            });
            return;
        }

        if (effectiveAccess == EffectiveAccessLevel.ReadOnly)
        {
            var method = context.Request.Method;
            var isSafeMethod = HttpMethods.IsGet(method) ||
                               HttpMethods.IsHead(method) ||
                               HttpMethods.IsOptions(method);

            if (!isSafeMethod)
            {
                _logger.LogWarning("Mutation rejected for read-only tenant {TenantId}: {Method} {Path}",
                    tenantId.Value, method, path);

                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "subscription_read_only",
                    message = "Tenant subscription is in read-only grace period. Modifications are disabled."
                });
                return;
            }
        }

        await _next(context);
    }

    private static bool IsExemptPath(string path)
    {
        if (path.StartsWith("/api/v1/platform-admin", StringComparison.OrdinalIgnoreCase))
            return true;

        if (path.StartsWith("/api/v1/auth", StringComparison.OrdinalIgnoreCase))
            return true;

        // Payment webhooks & direct gateways
        if (path.Contains("/webhook", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/v1/payments", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/v1/invoices/webhook", StringComparison.OrdinalIgnoreCase))
            return true;

        // Data export routes remain accessible in ReadOnly and Blocked
        if (path.Contains("/export", StringComparison.OrdinalIgnoreCase))
            return true;

        // Health and documentation
        if (path.StartsWith("/health", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/openapi", StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }
}
