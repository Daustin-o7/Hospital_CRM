using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hospital_CRM.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? ClinicId { get; set; }
    
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string PasswordHash { get; set; } = string.Empty;
    
    public UserRole Role { get; set; }
    
    public int FailedLoginCount { get; set; }
    
    public DateTimeOffset? LockedUntil { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    
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