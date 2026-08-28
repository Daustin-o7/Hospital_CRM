using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class ClinicHoliday
{
    public Guid Id { get; set; }
    public Guid ClinicId { get; set; }

    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Start date in YYYY-MM-DD format. Inclusive.
    /// </summary>
    [MaxLength(255)]
    public string StartDate { get; set; } = string.Empty;

    /// <summary>
    /// End date in YYYY-MM-DD format. Inclusive. If equal to StartDate, this is a single-day closure.
    /// </summary>
    [MaxLength(255)]
    public string EndDate { get; set; } = string.Empty;

    /// <summary>
    /// If true, this holiday recurs every year on the same date range.
    /// </summary>
    public bool RecurringAnnually { get; set; } = false;

    [MaxLength(500)]
    public string? InternalNote { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation
    public virtual Clinic Clinic { get; set; } = null!;
}