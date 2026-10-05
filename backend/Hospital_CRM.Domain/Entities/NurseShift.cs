using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

// One roster row. NurseProfileId null = open shift nurses can apply to.
public class NurseShift
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ClinicId { get; set; }

    public DateOnly Date { get; set; }
    public ShiftType ShiftType { get; set; }
    public ShiftStatus Status { get; set; } = ShiftStatus.Open;
    public Guid? NurseProfileId { get; set; }
    public string Notes { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid CreatedBy { get; set; }

    public virtual NurseProfile? Nurse { get; set; }
    public virtual ICollection<NurseShiftApplication> Applications { get; set; } = [];
}
