using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public Guid? TenantId { get; set; }
    public Guid? ClinicId { get; set; }

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    public string PasswordHash { get; set; } = string.Empty;

    [Required]
    public UserRole Role { get; set; }

    public int FailedLoginCount { get; set; }

    public DateTimeOffset? LockedUntil { get; set; }

    /// <summary>A1: set by the production bootstrap command; cleared when the password is changed.</summary>
    public bool MustChangePassword { get; set; }

    /// <summary>A1: TOTP is required before a PlatformAdmin may use the console.</summary>
    public bool MfaEnabled { get; set; }

    /// <summary>Protected TOTP secret (ISecretProtector); pending until MfaEnabled is set.</summary>
    [MaxLength(512)]
    public string? MfaSecret { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    [ConcurrencyCheck]
    public DateTimeOffset UpdatedAt { get; set; }

    // Validation helper
    public bool IsClinicAssociationValid()
    {
        // ClinicAdmin, Doctor, Receptionist, Nurse, and Pharmacist must have a ClinicId assigned
        if (Role is UserRole.Doctor or UserRole.Receptionist or UserRole.ClinicAdmin or UserRole.Nurse or UserRole.Pharmacist)
        {
            return ClinicId.HasValue && ClinicId.Value != Guid.Empty;
        }
        return true;
    }

    // Navigation properties
    public virtual Clinic? Clinic { get; set; }
    public virtual NurseProfile? NurseProfile { get; set; }
    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public virtual ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = [];
    public virtual ICollection<Patient> CreatedPatients { get; set; } = [];
    public virtual ICollection<PatientAuditLog> PatientAuditLogs { get; set; } = [];
    public virtual ICollection<PatientConsent> CapturedConsents { get; set; } = [];
    public virtual ICollection<Appointment> AppointmentsAsDoctor { get; set; } = [];
    public virtual ICollection<Consultation> Consultations { get; set; } = [];
    public virtual ICollection<StaffInvite> SentInvites { get; set; } = [];
}