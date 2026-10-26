using System.ComponentModel.DataAnnotations;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class LeaveRequest : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid NurseProfileId { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public LeaveType Type { get; set; }
    public LeaveStatus Status { get; set; } = LeaveStatus.Pending;

    public bool IsHalfDay { get; set; }

    [MaxLength(20)]
    public string? HalfDayPeriod { get; set; } // "morning" or "afternoon"

    public bool CertificateSeen { get; set; } // Avoids keeping sensitive raw medical files

    public bool CoverageGapAlertCreated { get; set; } // True if approved leave created open cover shifts

    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;

    public Guid RequestedBy { get; set; }
    public Guid? ReviewedBy { get; set; }
    public Guid? ApprovedOnBehalfOfUserId { get; set; } // If approved via authority proxy

    [MaxLength(500)]
    public string ReviewNote { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual NurseProfile Nurse { get; set; } = null!;
}
