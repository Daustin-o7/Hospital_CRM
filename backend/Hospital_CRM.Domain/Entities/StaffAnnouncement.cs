using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Structured team/ward announcements from Head Nurse or Clinic Admin.
/// </summary>
public class StaffAnnouncement : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ClinicId { get; set; }

    public Guid? TeamId { get; set; } // Null = Clinic-wide

    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(4000)]
    public string Content { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Priority { get; set; } = "normal"; // "normal", "urgent"

    public Guid AuthorUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ExpiresAt { get; set; }

    public virtual StaffTeam? Team { get; set; }
    public virtual User AuthorUser { get; set; } = null!;
}
