namespace Hospital_CRM.Domain.Constants;

/// <summary>
/// Centralized registry of system roles and common permission groupings.
/// Eliminates role drift across controllers, policies, and auth handlers.
/// </summary>
public static class RoleRegistry
{
    // Individual system roles
    public const string ClinicAdmin = "ClinicAdmin";
    public const string Owner = "Owner";
    public const string Doctor = "Doctor";
    public const string Receptionist = "Receptionist";
    public const string Pharmacist = "Pharmacist";
    public const string Nurse = "Nurse";
    public const string PlatformAdmin = "PlatformAdmin";

    // Common composite authorization groups
    public const string ClinicalStaff = $"{Doctor},{Nurse}";
    public const string AdminOrDoctor = $"{ClinicAdmin},{Owner},{Doctor}";
    public const string AdminOrReceptionist = $"{ClinicAdmin},{Owner},{Receptionist}";
    public const string ClinicalOrAdmin = $"{ClinicAdmin},{Owner},{Doctor},{Nurse}";
    public const string PharmacyAccess = $"{ClinicAdmin},{Owner},{Pharmacist},{Doctor},{Receptionist},{Nurse}";
    public const string AllClinicRoles = $"{ClinicAdmin},{Owner},{Doctor},{Receptionist},{Pharmacist},{Nurse}";

    // PlatformAdmin is not a clinic role: it is minted only by bootstrap/provisioning.
    public static readonly string[] All =
    [
        ClinicAdmin,
        Owner,
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
