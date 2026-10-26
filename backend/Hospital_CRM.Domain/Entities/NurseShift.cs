using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

// One roster shift assignment row. NurseProfileId null = open shift nurses can apply to or cover.
public class NurseShift : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ClinicId { get; set; }

    public Guid? RosterId { get; set; }
    public Guid? ShiftTemplateId { get; set; }

    [MaxLength(100)]
    public string? StationOrWard { get; set; } // Optional station/ward assignment

    public DateOnly Date { get; set; }
    public ShiftType ShiftType { get; set; }
    public ShiftStatus Status { get; set; } = ShiftStatus.Open;
    public Guid? NurseProfileId { get; set; }

    [Column(TypeName = "decimal(4,2)")]
    public decimal DurationHours { get; set; } = 8.0m;

    public bool IsLocked { get; set; }

    [MaxLength(500)]
    public string Notes { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid CreatedBy { get; set; }

    public virtual NurseProfile? Nurse { get; set; }
    public virtual StaffRoster? Roster { get; set; }
    public virtual ShiftTemplate? ShiftTemplate { get; set; }
    public virtual ICollection<NurseShiftApplication> Applications { get; set; } = [];
}
