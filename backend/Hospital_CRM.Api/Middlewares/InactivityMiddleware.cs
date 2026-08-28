using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Hospital_CRM.Api.Middlewares;

public class InactivityMiddleware
{
    private readonly RequestDelegate _next;
    private const int InactivityTimeoutMinutes = 30;

    public InactivityMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, IMemoryCache cache)
    {
        // Skip for unauthenticated requests and auth/health routes
        if (context.User.Identity is not { IsAuthenticated: true } ||
            context.Request.Path.StartsWithSegments("/api/v1/auth") ||
            context.Request.Path.StartsWithSegments("/health"))
        {
            await _next(context);
            return;
        }

        var role = context.User.GetUserRole();

        // Receptionist has no inactivity timeout (FR-01)
        if (string.Equals(role, UserRole.Receptionist.ToString(), StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        if (!string.Equals(role, nameof(UserRole.Doctor), StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(role, nameof(UserRole.ClinicAdmin), StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var userId = context.User.GetUserId();
        if (!userId.HasValue)
        {
            await _next(context);
            return;
        }

        // Cache check: Skip DB update if activity was verified within the last 2 minutes (BUG-040 optimization)
        var cacheKey = $"inactivity:{userId.Value}";
        if (cache.TryGetValue<DateTimeOffset>(cacheKey, out var lastCachedActivity) &&
            DateTimeOffset.UtcNow - lastCachedActivity < TimeSpan.FromMinutes(2))
        {
            await _next(context);
            return;
        }

        using var scope = context.RequestServices.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HospitalCrmDbContext>();

        var latestToken = await db.RefreshTokens
            .Where(t => t.UserId == userId.Value && t.RevokedAt == null)
            .OrderByDescending(t => t.LastUsedAt ?? t.IssuedAt)
            .FirstOrDefaultAsync();

        if (latestToken is not null)
        {
            var lastActivity = latestToken.LastUsedAt ?? latestToken.IssuedAt;
            if (DateTimeOffset.UtcNow - lastActivity > TimeSpan.FromMinutes(InactivityTimeoutMinutes))
            {
                var activeTokens = await db.RefreshTokens
                    .Where(t => t.UserId == userId.Value && t.RevokedAt == null)
                    .ToListAsync();

                foreach (var token in activeTokens)
                    token.RevokedAt = DateTimeOffset.UtcNow;

                await db.SaveChangesAsync();

                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new { error = "session_expired_due_to_inactivity" });
                return;
            }

            // Update timestamp & set cache entry
            latestToken.LastUsedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
            cache.Set(cacheKey, DateTimeOffset.UtcNow, TimeSpan.FromMinutes(2));
        }

        await _next(context);
    }
}
