using Microsoft.AspNetCore.Authorization;

namespace Hospital_CRM.Api.Authorization;

public class AuthorizeRolesAttribute : AuthorizeAttribute
{
    /// <summary>
    /// An Owner runs the clinic, so it reaches every ClinicAdmin area without being re-listed in
    /// ~160 attributes. Money and clinical writes are still gated separately by
    /// <c>[RequirePermission]</c>, so this grants area access, never an action.
    /// </summary>
    private static readonly string[] ClinicAdminAndOwner = ["ClinicAdmin", "Owner"];

    public AuthorizeRolesAttribute(params string[] roles)
    {
        Roles = string.Join(",", roles
            .SelectMany(role => role.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .SelectMany(role => string.Equals(role, "ClinicAdmin", StringComparison.OrdinalIgnoreCase)
                ? ClinicAdminAndOwner
                : [role])
            .Distinct(StringComparer.OrdinalIgnoreCase));
        Policy = null;
    }
}
