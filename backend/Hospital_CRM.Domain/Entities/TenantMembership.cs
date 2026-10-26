using System.ComponentModel.DataAnnotations;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Links a global User to a Tenant/Clinic with an assigned role.
/// Enables multi-clinic practitioners (e.g. doctors practicing at multiple clinics)
/// while guaranteeing that any issued JWT is strictly scoped to one tenant at a time.
/// </summary>
public class TenantMembership
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public Guid TenantId { get; set; }

    public Guid? ClinicId { get; set; }

    [Required]
    public UserRole Role { get; set; }

    public bool IsDefault { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "active"; // active, suspended, invited

    [MaxLength(100)]
    public string? RegistrationNumber { get; set; }

    [MaxLength(200)]
    public string? Qualifications { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public virtual User User { get; set; } = null!;
    public virtual Tenant Tenant { get; set; } = null!;
    public virtual Clinic? Clinic { get; set; }
}
