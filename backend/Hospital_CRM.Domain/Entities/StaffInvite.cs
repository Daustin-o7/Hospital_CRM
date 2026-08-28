using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class StaffInvite
{
    public Guid Id { get; set; }
    public Guid ClinicId { get; set; }
    
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;
    
    public UserRole Role { get; set; }
    
    [MaxLength(512)]
    public string TokenHash { get; set; } = string.Empty;
    
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    
    // Navigation
    public virtual Clinic Clinic { get; set; } = null!;
}