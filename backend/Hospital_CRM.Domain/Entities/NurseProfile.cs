using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class NurseProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TenantId { get; set; }

    // Employment
    public Guid DepartmentId { get; set; }
    public Guid? WardId { get; set; }
    public string Designation { get; set; } = string.Empty;
    public EmploymentType EmploymentType { get; set; }
    public DateOnly JoiningDate { get; set; }
    public Guid? SupervisorId { get; set; }
    public EmploymentStatus Status { get; set; }

    // Professional
    public string LicenseNumber { get; set; } = string.Empty;
    public string LicenseAuthority { get; set; } = string.Empty;
    public DateOnly LicenseIssueDate { get; set; }
    public DateOnly LicenseExpiryDate { get; set; }
    public string NursingQualification { get; set; } = string.Empty;
    public string Institution { get; set; } = string.Empty;
    public int GraduationYear { get; set; }
    public string Specialization { get; set; } = string.Empty;
    public int YearsExperience { get; set; }
    public string Skills { get; set; } = string.Empty;
    public string Languages { get; set; } = string.Empty;

    // Emergency
    public string EmergencyContactName { get; set; } = string.Empty;
    public string EmergencyContactPhone { get; set; } = string.Empty;
    public string EmergencyContactRelation { get; set; } = string.Empty;

    // Admin
    public string DocumentsJson { get; set; } = string.Empty;
    public string ShiftPreferencesJson { get; set; } = string.Empty;
    public string WorkRestrictionsJson { get; set; } = string.Empty;

    // Audit
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid CreatedBy { get; set; }
    public Guid UpdatedBy { get; set; }

    // Navigation
    public virtual User User { get; set; } = null!;
    public virtual ICollection<NurseAvailability> Availabilities { get; set; } = [];
}