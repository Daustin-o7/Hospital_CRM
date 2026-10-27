using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Services;

/// <summary>
/// Section 0: second-factor enrolment is mandatory for the roles that can move money,
/// write clinical notes, or operate the platform. Everyone else may opt in. Front-desk
/// billing is handled by the Receptionist role, so it is included with admin/doctor.
/// </summary>
public static class MfaPolicy
{
    public static bool RequiresEnrolment(UserRole role) =>
        role is UserRole.ClinicAdmin or UserRole.Owner or UserRole.Doctor or UserRole.PlatformAdmin or UserRole.Receptionist;
}
