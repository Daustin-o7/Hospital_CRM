using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Constants;

/// <summary>
/// Granular capability names used by <c>[RequirePermission]</c>. Roles are coarse routing;
/// these are the stable names the sections approve per action (e.g. money and clinical writes).
/// </summary>
public static class Permissions
{
    public const string PatientsRead = "patients.read";
    public const string PatientWrite = "patient.write";
    public const string VitalsWrite = "vitals.write";
    public const string ConsultationWrite = "consultation.write";
    public const string InvoiceWrite = "invoice.write";
    public const string PaymentRecord = "payment.record";
    public const string PharmacyDispense = "pharmacy.dispense";
    public const string LedgerWrite = "ledger.write";

    private static readonly Dictionary<string, HashSet<UserRole>> Granted = new(StringComparer.Ordinal)
    {
        [PatientsRead] = [UserRole.ClinicAdmin, UserRole.Owner, UserRole.Receptionist, UserRole.Doctor, UserRole.Nurse],
        [PatientWrite] = [UserRole.ClinicAdmin, UserRole.Owner, UserRole.Receptionist, UserRole.Doctor],
        [VitalsWrite] = [UserRole.Nurse, UserRole.Doctor, UserRole.ClinicAdmin, UserRole.Owner, UserRole.Receptionist],
        [ConsultationWrite] = [UserRole.Doctor],
        [InvoiceWrite] = [UserRole.ClinicAdmin, UserRole.Owner, UserRole.Receptionist, UserRole.Doctor],
        [PaymentRecord] = [UserRole.ClinicAdmin, UserRole.Owner, UserRole.Receptionist, UserRole.Doctor, UserRole.Pharmacist],
        [PharmacyDispense] = [UserRole.ClinicAdmin, UserRole.Owner, UserRole.Pharmacist, UserRole.Doctor],
        [LedgerWrite] = [UserRole.ClinicAdmin, UserRole.Owner]
    };

    public static bool IsKnown(string? permission) =>
        !string.IsNullOrWhiteSpace(permission) && Granted.ContainsKey(permission.Trim());

    public static bool RoleHasPermission(UserRole role, string? permission) =>
        !string.IsNullOrWhiteSpace(permission)
        && Granted.TryGetValue(permission.Trim(), out var roles)
        && roles.Contains(role);
}
