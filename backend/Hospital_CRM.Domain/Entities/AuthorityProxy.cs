using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Time-boxed authority delegation (e.g. Head Nurse is on leave, Charge Nurse approves swaps/leaves).
/// Rules:
/// 1. Time-boxed with mandatory ValidUntil end date.
/// 2. Scoped to explicit permissions (never "act as this user").
/// 3. Designee cannot approve their own requests.
/// 4. Every action logged as "approved by X on behalf of Y".
/// </summary>
public class AuthorityProxy : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ClinicId { get; set; }

    public Guid DelegatorUserId { get; set; } // The Head Nurse / Supervisor
    public Guid DesigneeUserId { get; set; }  // The Acting Substitute

    [MaxLength(200)]
    public string Permissions { get; set; } = "roster.approve,leave.approve";

    public DateTimeOffset ValidFrom { get; set; }
    public DateTimeOffset ValidUntil { get; set; } // Mandatory expiration date

    public bool IsRevoked { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid CreatedBy { get; set; }

    public virtual User DelegatorUser { get; set; } = null!;
    public virtual User DesigneeUser { get; set; } = null!;
}
