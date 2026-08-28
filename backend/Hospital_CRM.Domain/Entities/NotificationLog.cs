using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class NotificationLog
{
    public Guid Id { get; set; }
    public Guid AppointmentId { get; set; }
    
    public NotificationChannel Channel { get; set; }
    
    [MaxLength(100)]
    public string Template { get; set; } = string.Empty;
    
    public NotificationStatus Status { get; set; }
    
    public DateTimeOffset? SentAt { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
    
    [MaxLength(500)]
    public string? FailedReason { get; set; }
    
    // Navigation
    public virtual Appointment Appointment { get; set; } = null!;
}