namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// FR-14-03: Every impersonation session is fully audit-logged — who, which tenant,
/// which user, start/end time. The single highest-bar audit requirement in Phase 2.
/// </summary>
public class ImpersonationLog
{
    public Guid Id { get; set; }
    public Guid PlatformAdminId { get; set; }
    public Guid TenantId { get; set; }
    public Guid ImpersonatedUserId { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public string? Reason { get; set; }
}
