namespace Hospital_CRM.Domain.Constants;

/// <summary>
/// Centralized registry of system roles and common permission groupings.
/// Eliminates role drift across controllers, policies, and auth handlers.
/// </summary>
public static class RoleRegistry
{
    // Individual system roles
    public const string ClinicAdmin = "ClinicAdmin";
    public const string Doctor = "Doctor";
    public const string Receptionist = "Receptionist";
    public const string Pharmacist = "Pharmacist";
    public const string Nurse = "Nurse";
    public const string PlatformAdmin = "PlatformAdmin";

    // Common composite authorization groups
    public const string ClinicalStaff = $"{Doctor},{Nurse}";
    public const string AdminOrDoctor = $"{ClinicAdmin},{Doctor}";
    public const string AdminOrReceptionist = $"{ClinicAdmin},{Receptionist}";
    public const string ClinicalOrAdmin = $"{ClinicAdmin},{Doctor},{Nurse}";
    public const string PharmacyAccess = $"{ClinicAdmin},{Pharmacist},{Doctor},{Receptionist},{Nurse}";
    public const string AllClinicRoles = $"{ClinicAdmin},{Doctor},{Receptionist},{Pharmacist},{Nurse}";

    public static readonly string[] All =
    [
        ClinicAdmin,
        Doctor,
        Receptionist,
        Pharmacist,
        Nurse,
        PlatformAdmin
    ];

    public static bool IsValid(string? role) =>
        !string.IsNullOrWhiteSpace(role) &&
        All.Contains(role, StringComparer.OrdinalIgnoreCase);
}
