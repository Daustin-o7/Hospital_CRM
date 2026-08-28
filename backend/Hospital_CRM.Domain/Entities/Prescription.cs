using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class Prescription
{
    public Guid Id { get; set; }
    public Guid ConsultationId { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
    
    // Navigation
    public virtual Consultation Consultation { get; set; } = null!;
    public virtual ICollection<PrescriptionItem> Items { get; set; } = [];
}