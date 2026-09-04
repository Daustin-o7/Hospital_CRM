using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class PrecheckSubmission
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid AppointmentId { get; set; }
    
    [MaxLength(128)]
    public string TokenHash { get; set; } = null!;
    
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    
    [MaxLength(2000)]
    public string? ChiefComplaint { get; set; }
    
    [MaxLength(500)]
    public string? SymptomDuration { get; set; }
    
    [MaxLength(2000)]
    public string? Medications { get; set; }
    
    [MaxLength(1000)]
    public string? Allergies { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
    
    public virtual Appointment Appointment { get; set; } = null!;
}