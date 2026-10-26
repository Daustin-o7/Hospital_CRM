using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public enum RosterStatus
{
    Draft = 0,
    Published = 1,
    Locked = 2
}

/// <summary>
/// Staff duty roster lifecycle: Draft -> Published -> Locked.
/// Post-publish edits generate audit logs and staff notifications.
/// </summary>
public class StaffRoster : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ClinicId { get; set; }

    [MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public RosterStatus Status { get; set; } = RosterStatus.Draft;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid CreatedBy { get; set; }

    public DateTimeOffset? PublishedAt { get; set; }
    public Guid? PublishedBy { get; set; }

    public DateTimeOffset? LockedAt { get; set; }
    public Guid? LockedBy { get; set; }

    public virtual ICollection<NurseShift> Shifts { get; set; } = [];
}
