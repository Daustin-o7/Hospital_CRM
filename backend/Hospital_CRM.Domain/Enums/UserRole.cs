namespace Hospital_CRM.Domain.Enums;

public enum UserRole
{
    ClinicAdmin,
    Doctor,
    Receptionist,
    PlatformAdmin,  // MOD-14: SAMSTACK's own staff — never exposed to clinic users
    Pharmacist,     // Track 2 (MOD-15/16/17): Pharmacy Dispensing & Stock Management
    Nurse           // Track 4 (MOD-20/21/22/26): In-Patient Department & Ward Care
}