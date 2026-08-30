namespace Hospital_CRM.Domain.Enums;

public enum UserRole
{
    ClinicAdmin,
    Doctor,
    Receptionist,
    PlatformAdmin  // MOD-14: SAMSTACK's own staff — never exposed to clinic users
}