using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Middlewares;

public class InactivityMiddleware
{
    private readonly RequestDelegate _next;
    private const int InactivityTimeoutMinutes = 30;

    public InactivityMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        await _next(context);

        if (context.User.Identity is not { IsAuthenticated: true })
            return;

        var role = context.User.FindFirst("role")?.Value;

        // Receptionist has no inactivity timeout
        if (string.Equals(role, UserRole.Receptionist.ToString(), StringComparison.OrdinalIgnoreCase))
            return;

        if (role is not (nameof(UserRole.Doctor) or nameof(UserRole.ClinicAdmin)))
            return;

        var userIdClaim = context.User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
            return;

        using var scope = context.RequestServices.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HospitalCrmDbContext>();

        var latestToken = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .OrderByDescending(t => t.LastUsedAt ?? t.IssuedAt)
            .FirstOrDefaultAsync();

        if (latestToken is null)
            return;

        var lastActivity = latestToken.LastUsedAt ?? latestToken.IssuedAt;
        if (DateTimeOffset.UtcNow - lastActivity > TimeSpan.FromMinutes(InactivityTimeoutMinutes))
        {
            // Revoke all tokens for this user
            var activeTokens = await db.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedAt == null)
                .ToListAsync();
            foreach (var token in activeTokens)
                token.RevokedAt = DateTimeOffset.UtcNow;

            await db.SaveChangesAsync();
        }
    }
}
