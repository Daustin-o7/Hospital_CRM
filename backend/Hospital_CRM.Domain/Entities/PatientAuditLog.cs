using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class PatientAuditLog
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid ChangedBy { get; set; }
    
    [MaxLength(100)]
    public string FieldName { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string OldValue { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string NewValue { get; set; } = string.Empty;
    
    public DateTimeOffset ChangedAt { get; set; }
    
    // Navigation
    public virtual User ChangedByUser { get; set; } = null!;
}