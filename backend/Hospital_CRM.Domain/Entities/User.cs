using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
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

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Validation helper
    public bool IsClinicAssociationValid()
    {
        // ClinicAdmin, Doctor, and Receptionist must have a ClinicId assigned
        if (Role is UserRole.Doctor or UserRole.Receptionist or UserRole.ClinicAdmin)
        {
            return ClinicId.HasValue && ClinicId.Value != Guid.Empty;
        }
        return true;
    }

    // Navigation properties
    public virtual Clinic? Clinic { get; set; }
    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public virtual ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = [];
    public virtual ICollection<Patient> CreatedPatients { get; set; } = [];
    public virtual ICollection<PatientAuditLog> PatientAuditLogs { get; set; } = [];
    public virtual ICollection<PatientConsent> CapturedConsents { get; set; } = [];
    public virtual ICollection<Appointment> AppointmentsAsDoctor { get; set; } = [];
    public virtual ICollection<Consultation> Consultations { get; set; } = [];
    public virtual ICollection<StaffInvite> SentInvites { get; set; } = [];
}