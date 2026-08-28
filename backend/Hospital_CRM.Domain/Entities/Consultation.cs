using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class Consultation
{
    public Guid Id { get; set; }
    public Guid AppointmentId { get; set; }
    public Guid DoctorId { get; set; }
    
    public string? ChiefComplaint { get; set; }
    public string? Observations { get; set; }
    public string? Diagnosis { get; set; }
    
    public int Version { get; set; } = 1;
    public Guid? PreviousVersionId { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
    
    // Navigation — append-only versioned (FR-14)
    public virtual Appointment Appointment { get; set; } = null!;
    public virtual User Doctor { get; set; } = null!;
    public virtual Consultation? PreviousVersion { get; set; }
    public virtual ICollection<Prescription> Prescriptions { get; set; } = [];
}