using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class StaffInvite : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ClinicId { get; set; }
    
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;
    
    public UserRole Role { get; set; }
    
    [MaxLength(512)]
    public string TokenHash { get; set; } = string.Empty;
    
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    
    // Nurse-specific fields
    public Guid? NurseProfileId { get; set; }
    public string LicenseNumber { get; set; } = string.Empty;
    public string LicenseAuthority { get; set; } = string.Empty;
    public DateOnly? LicenseIssueDate { get; set; }
    public DateOnly? LicenseExpiryDate { get; set; }
    public string NursingQualification { get; set; } = string.Empty;
    public string Institution { get; set; } = string.Empty;
    public int GraduationYear { get; set; }
    public string Specialization { get; set; } = string.Empty;
    public int YearsExperience { get; set; }
    public string Skills { get; set; } = string.Empty;
    public string Languages { get; set; } = string.Empty;
    public string EmergencyContactName { get; set; } = string.Empty;
    public string EmergencyContactPhone { get; set; } = string.Empty;
    public string EmergencyContactRelation { get; set; } = string.Empty;
    public string ShiftPreferencesJson { get; set; } = string.Empty;
    public string WorkRestrictionsJson { get; set; } = string.Empty;
    public Guid? DepartmentId { get; set; }
    public Guid? WardId { get; set; }
    public string Designation { get; set; } = string.Empty;
    public EmploymentType EmploymentType { get; set; }
    public EmploymentStatus EmploymentStatus { get; set; }
    
    // Navigation
    public virtual Clinic Clinic { get; set; } = null!;
    public virtual NurseProfile? NurseProfile { get; set; }
}