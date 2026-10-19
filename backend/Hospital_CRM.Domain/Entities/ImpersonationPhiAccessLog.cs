using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// A5: every PHI read performed during an impersonation session, stored durably so the
/// evidence survives a restart. Append-only: app_user has no UPDATE/DELETE on this table.
/// </summary>
public class ImpersonationPhiAccessLog
{
    public Guid Id { get; set; }
    public Guid ImpersonationId { get; set; }
    public Guid PlatformAdminId { get; set; }
    public Guid ImpersonatedUserId { get; set; }
    public Guid? TenantId { get; set; }

    [MaxLength(512)]
    public string Path { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Method { get; set; } = string.Empty;

    public int StatusCode { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}
