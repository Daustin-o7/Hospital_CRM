using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class AppointmentHistory
{
    public Guid Id { get; set; }
    public Guid AppointmentId { get; set; }
    
    public DateOnly PreviousDate { get; set; }
    public string PreviousTimeSlot { get; set; } = string.Empty;
    public AppointmentStatus PreviousStatus { get; set; }
    
    public Guid ChangedBy { get; set; }
    public DateTimeOffset ChangedAt { get; set; }
    
    // Navigation
    public virtual Appointment Appointment { get; set; } = null!;
}