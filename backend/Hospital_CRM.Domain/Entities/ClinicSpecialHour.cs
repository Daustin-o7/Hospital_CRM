using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Special opening hours override the normal weekly schedule for a specific date.
/// Used when a clinic is normally closed on a day but opens for a special clinic,
/// or has different hours than normal on a specific date.
/// </summary>
public class ClinicSpecialHour
{
    public Guid Id { get; set; }
    public Guid ClinicId { get; set; }

    /// <summary>
    /// Date of the special opening in YYYY-MM-DD format.
    /// </summary>
    [MaxLength(255)]
    public string Date { get; set; } = string.Empty;

    public string OpenTime { get; set; } = string.Empty; // e.g. "10:00"
    public string CloseTime { get; set; } = string.Empty; // e.g. "14:00"

    [MaxLength(500)]
    public string? Reason { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation
    public virtual Clinic Clinic { get; set; } = null!;
}