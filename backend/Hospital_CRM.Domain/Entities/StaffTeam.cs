using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Staff team membership object (e.g. Ward A, ICU Night Team).
/// Replaces risky unstructured chat with structured coordination:
/// 1. Announcements board from Head Nurse
/// 2. Open-shift cover board
/// 3. In-app roster notifications
/// </summary>
public class StaffTeam : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ClinicId { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? WardOrDepartment { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual ICollection<StaffTeamMember> Members { get; set; } = [];
    public virtual ICollection<StaffAnnouncement> Announcements { get; set; } = [];
}

public class StaffTeamMember : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid TeamId { get; set; }
    public Guid UserId { get; set; }

    [MaxLength(50)]
    public string RoleInTeam { get; set; } = "member"; // "member" or "lead"

    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual StaffTeam Team { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}
