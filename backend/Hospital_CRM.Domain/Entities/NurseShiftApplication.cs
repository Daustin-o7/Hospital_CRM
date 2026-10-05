using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class NurseShiftApplication
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ShiftId { get; set; }
    public Guid NurseProfileId { get; set; }

    public ShiftApplicationStatus Status { get; set; } = ShiftApplicationStatus.Applied;
    public DateTimeOffset AppliedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public virtual NurseShift Shift { get; set; } = null!;
    public virtual NurseProfile Nurse { get; set; } = null!;
}
