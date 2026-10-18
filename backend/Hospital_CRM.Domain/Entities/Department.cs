using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class Department
{
    public Guid Id { get; set; }
    public Guid ClinicId { get; set; }
    public Guid TenantId { get; set; }

    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [MaxLength(255)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    [ConcurrencyCheck]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public virtual Clinic Clinic { get; set; } = null!;
    public virtual ICollection<NurseProfile> Nurses { get; set; } = [];
}
