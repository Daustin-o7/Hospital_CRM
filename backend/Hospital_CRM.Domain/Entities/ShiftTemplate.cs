using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Configurable shift template per clinic (e.g. Morning, Evening, Night).
/// Handles cross-midnight night shifts cleanly using start time + duration in clinic timezone.
/// </summary>
public class ShiftTemplate : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ClinicId { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(10)]
    public string StartTime { get; set; } = "07:00"; // HH:mm in clinic timezone

    [MaxLength(10)]
    public string EndTime { get; set; } = "15:30"; // HH:mm

    public bool CrossesMidnight { get; set; }

    [Column(TypeName = "decimal(4,2)")]
    public decimal DurationHours { get; set; } = 8.0m;

    public int RequiredCoverage { get; set; } = 2;
    public bool IsActive { get; set; } = true;

    [MaxLength(200)]
    public string? Description { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
