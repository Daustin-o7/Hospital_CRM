using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class ClinicHours
{
    public Guid Id { get; set; }
    public Guid ClinicId { get; set; }

    /// <summary>
    /// Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
    /// Sunday MUST be a first-class configurable day.
    /// </summary>
    public int DayOfWeek { get; set; }

    /// <summary>
    /// Shift index for split shifts (0, 1, 2, ...). Allows multiple
    /// working intervals per day (e.g., 09:00–13:00 and 14:00–18:00).
    /// </summary>
    public int ShiftIndex { get; set; } = 0;

    public string OpenTime { get; set; } = string.Empty; // e.g. "09:00"
    public string CloseTime { get; set; } = string.Empty; // e.g. "18:00"

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation
    public virtual Clinic Clinic { get; set; } = null!;
}