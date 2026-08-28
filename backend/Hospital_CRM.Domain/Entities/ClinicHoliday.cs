using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class ClinicHoliday
{
    public Guid Id { get; set; }
    public Guid ClinicId { get; set; }
    
    [MaxLength(255)]
    public string Date { get; set; } = string.Empty; // e.g. "2026-10-02"
    
    // Navigation
    public virtual Clinic Clinic { get; set; } = null!;
}