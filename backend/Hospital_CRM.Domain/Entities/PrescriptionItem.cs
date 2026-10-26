using System.ComponentModel.DataAnnotations;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class PrescriptionItem
{
    public Guid Id { get; set; }
    public Guid PrescriptionId { get; set; }
    
    // Structured references
    public Guid? DrugId { get; set; }

    [MaxLength(255)]
    public string GenericName { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? BrandName { get; set; }

    [MaxLength(100)]
    public string DosageForm { get; set; } = "Tablet"; // Tablet, Capsule, Syrup, Injection, etc.

    [MaxLength(100)]
    public string Strength { get; set; } = string.Empty; // e.g., 500mg, 10mg/5ml

    [MaxLength(100)]
    public string Route { get; set; } = "Oral"; // Oral, IV, IM, Topical, Inhalation

    [MaxLength(100)]
    public string Frequency { get; set; } = "1-0-1"; // 1-0-1, 1-1-1, 0-0-1, 1-0-0, QDS, PRN

    public int Duration { get; set; } = 5;

    [MaxLength(50)]
    public string DurationUnit { get; set; } = "Days"; // Days, Weeks, Months

    [MaxLength(100)]
    public string Timing { get; set; } = "After food"; // Before food, After food, With food, Empty stomach

    public int TotalQuantity { get; set; } = 10;

    [MaxLength(500)]
    public string? SpecialInstructions { get; set; }

    public ScheduleClass ScheduleClass { get; set; } = ScheduleClass.General;

    public bool IsUnverified { get; set; } = false; // true if custom drug entered not in database

    public bool IsDispensed { get; set; } = false;
    public int DispensedQuantity { get; set; } = 0;
    public Guid? DispensedBatchId { get; set; }
    [MaxLength(500)]
    public string? SubstitutionReason { get; set; }
    public Guid? SubstitutedDrugId { get; set; }

    // Legacy text compatibility
    [MaxLength(500)]
    public string MedicineText { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string DosageText { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string FrequencyText { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string DurationText { get; set; } = string.Empty;
    
    // Navigation
    public virtual Prescription Prescription { get; set; } = null!;
    public virtual Drug? Drug { get; set; }
}