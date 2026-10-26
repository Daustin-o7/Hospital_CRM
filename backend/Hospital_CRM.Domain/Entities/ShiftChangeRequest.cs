using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public enum ShiftChangeType
{
    DirectSwap = 0, // A and B trade shifts
    OpenCover = 1   // A posts shift, any eligible nurse can claim
}

public enum ShiftChangeStatus
{
    Requested = 0,
    Accepted = 1,
    Approved = 2,
    Applied = 3,
    Rejected = 4,
    Expired = 5,
    Cancelled = 6
}

/// <summary>
/// Shift change request workflow:
/// requested -> accepted by nurse B -> approved by head nurse -> applied.
/// Exits: rejected, expired, cancelled.
/// </summary>
public class ShiftChangeRequest : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ClinicId { get; set; }

    public ShiftChangeType RequestType { get; set; }
    public ShiftChangeStatus Status { get; set; } = ShiftChangeStatus.Requested;

    public Guid RequesterNurseProfileId { get; set; }
    public Guid RequesterShiftId { get; set; }

    public Guid? TargetNurseProfileId { get; set; } // Null for OpenCover until claimed
    public Guid? TargetShiftId { get; set; }         // Null for OpenCover

    public DateTimeOffset RequestedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public DateTimeOffset? AppliedAt { get; set; }

    public Guid? ApprovedByUserId { get; set; }
    public Guid? ApprovedOnBehalfOfUserId { get; set; } // When approved by an authority proxy

    [MaxLength(500)]
    public string? Reason { get; set; }

    [MaxLength(500)]
    public string? RejectionReason { get; set; }

    // Navigation
    public virtual NurseProfile RequesterNurse { get; set; } = null!;
    public virtual NurseShift RequesterShift { get; set; } = null!;
    public virtual NurseProfile? TargetNurse { get; set; }
    public virtual NurseShift? TargetShift { get; set; }
}
