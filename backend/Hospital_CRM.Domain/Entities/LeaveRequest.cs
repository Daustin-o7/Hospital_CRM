using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class LeaveRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid NurseProfileId { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public LeaveType Type { get; set; }
    public LeaveStatus Status { get; set; } = LeaveStatus.Pending;
    public string Reason { get; set; } = string.Empty;

    public Guid RequestedBy { get; set; }
    public Guid? ReviewedBy { get; set; }
    public string ReviewNote { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public virtual NurseProfile Nurse { get; set; } = null!;
}
