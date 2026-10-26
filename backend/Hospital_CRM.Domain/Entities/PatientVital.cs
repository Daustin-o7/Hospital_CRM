using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Core clinical entity: Triage vitals captured by nurse or doctor before consultation.
/// Core requirement independent of the optional staff_roster module.
/// </summary>
public class PatientVital : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    public Guid AppointmentId { get; set; }
    public Guid PatientId { get; set; }

    public int? SystolicBp { get; set; }
    public int? DiastolicBp { get; set; }
    public int? HeartRate { get; set; }

    [Column(TypeName = "decimal(4,1)")]
    public decimal? Temperature { get; set; } // in Fahrenheit

    public int? RespiratoryRate { get; set; }
    public int? SpO2 { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? WeightKg { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal? HeightCm { get; set; }

    [Column(TypeName = "decimal(4,1)")]
    public decimal? Bmi { get; set; }

    [Column(TypeName = "decimal(5,1)")]
    public decimal? BloodGlucoseMgDl { get; set; }

    [MaxLength(500)]
    public string? Allergies { get; set; }

    [MaxLength(1000)]
    public string? BedsideObservations { get; set; }

    public Guid RecordedByUserId { get; set; }
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public virtual Appointment Appointment { get; set; } = null!;
    public virtual Patient Patient { get; set; } = null!;
    public virtual User RecordedByUser { get; set; } = null!;
}
