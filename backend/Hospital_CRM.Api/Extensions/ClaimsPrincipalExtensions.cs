using System.Security.Claims;

namespace Hospital_CRM.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static Guid? GetUserId(this ClaimsPrincipal? user)
    {
        if (user is null) return null;
        var claim = user.FindFirst(ClaimTypes.NameIdentifier) ?? user.FindFirst("sub");
        if (claim is null || !Guid.TryParse(claim.Value, out var userId))
            return null;
        return userId;
    }

    public static string? GetUserRole(this ClaimsPrincipal? user)
    {
        if (user is null) return null;
        return user.FindFirst(ClaimTypes.Role)?.Value ?? user.FindFirst("role")?.Value;
    }

    public static Guid? GetClinicId(this ClaimsPrincipal? user)
    {
        if (user is null) return null;
        var claim = user.FindFirst("clinicId");
        if (claim is null || !Guid.TryParse(claim.Value, out var clinicId))
            return null;
        return clinicId;
    }
}
