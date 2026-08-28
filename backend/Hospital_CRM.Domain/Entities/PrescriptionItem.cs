using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class PrescriptionItem
{
    public Guid Id { get; set; }
    public Guid PrescriptionId { get; set; }
    
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
}