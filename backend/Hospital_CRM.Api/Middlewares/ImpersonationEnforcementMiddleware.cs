using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Middlewares;

/// <summary>
/// A5: Request middleware enforcing impersonation constraints per FR-14-03 / TRD_Phase2 §7.
/// - Session liveness: a token whose ImpersonationLogs.EndedAt is set (or whose session row is
///   missing) is rejected with 403 impersonation_ended, so "End session" takes effect at once
///   instead of waiting for the 30-minute expiry.
/// - Read-only enforcement: rejects any non-safe method (POST, PUT, PATCH, DELETE) with HTTP 403 impersonation_read_only.
///   Exception: endpoints ending in /impersonate/{id}/end or /impersonate/end, allowing the session to terminate.
/// - Access audit: every PHI read (GET to patients, consults, prescriptions, labs, appointments, etc.)
///   is written with both the Platform Admin identity (impersonated_by claim) and target user identity.
/// </summary>
public class ImpersonationEnforcementMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ImpersonationEnforcementMiddleware> _logger;

    public ImpersonationEnforcementMiddleware(
        RequestDelegate next,
        ILogger<ImpersonationEnforcementMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    // Scoped services (DbContext, audit) are injected per request: the middleware itself is a singleton.
    public async Task InvokeAsync(HttpContext context, HospitalCrmDbContext db, IImpersonationAuditService auditService)
    {
        var user = context.User;

        // Only enforce for authenticated users carrying the impersonated_by claim
        if (user?.Identity?.IsAuthenticated != true || !user.HasClaim(c => c.Type == "impersonated_by"))
        {
            await _next(context);
            return;
        }

        var impersonatedByClaim = user.FindFirst("impersonated_by")?.Value;
        var path = context.Request.Path.Value ?? string.Empty;
        var method = context.Request.Method;
        var impersonationIdStr = user.FindFirst("impersonation_id")?.Value;
        var hasSessionId = Guid.TryParse(impersonationIdStr, out var impersonationId);

        // End the session for real: the token alone stays valid until exp otherwise.
        var session = hasSessionId
            ? await db.ImpersonationLogs.AsNoTracking()
                .Where(l => l.Id == impersonationId)
                .Select(l => new { l.EndedAt })
                .FirstOrDefaultAsync(context.RequestAborted)
            : null;

        if (session is null || session.EndedAt is not null)
        {
            _logger.LogWarning(
                "Impersonation token rejected: session {ImpersonationId} {State} for {Method} {Path}",
                impersonationIdStr,
                session is null ? "not found" : "already ended",
                method, path);

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "impersonation_ended",
                message = "This impersonation session is no longer active."
            });
            return;
        }

        var isSafeMethod = HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method);
        var isEndImpersonation = path.Contains("/impersonate", StringComparison.OrdinalIgnoreCase)
                                 && path.EndsWith("/end", StringComparison.OrdinalIgnoreCase);

        if (!isSafeMethod && !isEndImpersonation)
        {
            _logger.LogWarning(
                "Impersonation write attempt blocked: Admin {AdminId} impersonating {UserId} attempted {Method} {Path}",
                impersonatedByClaim, user.GetUserId(), method, path);

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "impersonation_read_only",
                message = "Modifications are not allowed during an impersonated session."
            });
            return;
        }

        await _next(context);

        // Access audit: if this read succeeded and touched PHI data, record it with both identities
        if (context.Response.StatusCode >= 200 && context.Response.StatusCode < 300 && IsPhiEndpoint(path))
        {
            var adminId = Guid.TryParse(impersonatedByClaim, out var aId) ? aId : Guid.Empty;
            var userId = user.GetUserId() ?? Guid.Empty;
            var tenantId = user.GetTenantId();

            await auditService.RecordPhiAccessAsync(
                impersonationId,
                adminId,
                userId,
                tenantId,
                path,
                method,
                context.Response.StatusCode,
                context.RequestAborted);
        }
    }

    private static bool IsPhiEndpoint(string path)
    {
        return path.StartsWith("/api/v1/patients", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/v1/consultations", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/v1/appointments", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/v1/lab-orders", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/v1/invoices", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/v1/nurse-care", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/v1/pharmacy", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/v1/queue", StringComparison.OrdinalIgnoreCase);
    }
}
