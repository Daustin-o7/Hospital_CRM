using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class Clinic
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    
    public DateTimeOffset CreatedAt { get; set; }
    
    // Navigation
    public virtual ICollection<ClinicHours> WorkingHours { get; set; } = [];
    public virtual ICollection<ClinicHoliday> Holidays { get; set; } = [];
    public virtual ICollection<StaffInvite> StaffInvites { get; set; } = [];
    public virtual ICollection<User> Users { get; set; } = [];
}