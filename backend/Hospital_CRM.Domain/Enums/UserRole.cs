namespace Hospital_CRM.Domain.Enums;

// Values are persisted as ints in "Users"."Role" and minted into the role claim.
// Append only — renumbering silently reassigns every existing user's role.
public enum UserRole
{
    ClinicAdmin     = 0,
    Doctor          = 1,
    Receptionist    = 2,
    PlatformAdmin   = 3,  // MOD-14: SAMSTACK's own staff — never exposed to clinic users
    Pharmacist      = 4,  // Track 2 (MOD-15/16/17): Pharmacy Dispensing & Stock Management
    Nurse           = 5,  // Track 4 (MOD-20/21/22/26): In-Patient Department & Ward Care
    Owner           = 6   // Clinic owner — can approve payee changes, dual-control thresholds
}
