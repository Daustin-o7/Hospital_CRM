using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class Patient
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(50)]
    public string Phone { get; set; } = string.Empty;
    
    public bool DobHasValue { get; set; }
    public DateOnly? Dob { get; set; }
    public int? ApproxAge { get; set; }
    public Gender Gender { get; set; }
    public string? Address { get; set; }
    
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? IdempotencyKey { get; set; }
    
    // Navigation
    public virtual User CreatedByUser { get; set; } = null!;
    public virtual ICollection<PatientConsent> Consents { get; set; } = [];
    public virtual ICollection<Appointment> Appointments { get; set; } = [];
    public virtual ICollection<PatientAuditLog> AuditLogs { get; set; } = [];
}