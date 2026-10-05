using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class NurseAvailability
{
    public Guid Id { get; set; }
    public Guid NurseProfileId { get; set; }
    public Guid TenantId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public ShiftPreference PreferredShift { get; set; }
    public Guid? PreferredWardId { get; set; }
    public bool NightShiftWilling { get; set; }
    public bool WeekendWilling { get; set; }
    public bool OvertimeWilling { get; set; }
    public string Notes { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation
    public virtual NurseProfile NurseProfile { get; set; } = null!;
}

public enum ShiftPreference
{
    Morning,
    Evening,
    Night,
    Any,
    NoPreference
}