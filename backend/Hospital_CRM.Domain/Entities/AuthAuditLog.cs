using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Append-only record of authentication and authorisation events (Section 0).
/// Global, not tenant-filtered: failed logins have no resolved tenant yet, and a
/// support impersonation must remain visible across tenants.
/// </summary>
public class AuthAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? TenantId { get; set; }
    public Guid? UserId { get; set; }

    [MaxLength(255)]
    public string? Email { get; set; }

    /// <summary>login_succeeded, login_failed, login_locked, mfa_verified, refresh_rotated, ...</summary>
    [Required]
    [MaxLength(50)]
    public string EventType { get; set; } = string.Empty;

    /// <summary>success | failure | denied</summary>
    [Required]
    [MaxLength(20)]
    public string Outcome { get; set; } = "success";

    [MaxLength(500)]
    public string? Detail { get; set; }

    [MaxLength(64)]
    public string? IpAddress { get; set; }

    [MaxLength(512)]
    public string? UserAgent { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
