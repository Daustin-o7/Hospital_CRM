using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class ClinicHours
{
    public Guid Id { get; set; }
    public Guid ClinicId { get; set; }
    
    public int DayOfWeek { get; set; } // 0 = Sunday, 6 = Saturday
    public string OpenTime { get; set; } = string.Empty; // e.g. "09:00"
    public string CloseTime { get; set; } = string.Empty; // e.g. "18:00"
    
    // Navigation
    public virtual Clinic Clinic { get; set; } = null!;
}