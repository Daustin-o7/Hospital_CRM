using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Constants;

/// <summary>
/// FR-04: the normal invite path may not mint a ClinicAdmin, an Owner or a PlatformAdmin —
/// all three outrank the admin sending the invite. B3 provisioning is the single documented
/// exception and calls this with allowClinicAdmin.
/// Enum.TryParse accepts numeric strings ("0"), so numbers are rejected explicitly.
/// </summary>
public static class StaffRolePolicy
{
    public static bool TryParseInvitableRole(string? raw, bool allowClinicAdmin, out UserRole role)
    {
        role = default;
        if (string.IsNullOrWhiteSpace(raw) || int.TryParse(raw, out _))
            return false;

        if (!Enum.TryParse<UserRole>(raw, true, out var parsed) || !Enum.IsDefined(parsed))
            return false;

        if (parsed == UserRole.PlatformAdmin)
            return false;

        if ((parsed == UserRole.ClinicAdmin || parsed == UserRole.Owner) && !allowClinicAdmin)
            return false;

        role = parsed;
        return true;
    }
}
