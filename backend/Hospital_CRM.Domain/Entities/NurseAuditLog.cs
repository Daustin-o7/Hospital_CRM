namespace Hospital_CRM.Domain.Entities;

// Append-only — REVOKE UPDATE, DELETE enforced at DB role level (see migration).
public class NurseAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public string EntityType { get; set; } = string.Empty; // NurseProfile / NurseShift / LeaveRequest / ShiftHandover
    public Guid EntityId { get; set; }
    public Guid? NurseProfileId { get; set; }
    public string Action { get; set; } = string.Empty;     // created / assigned / cancelled / approved / rejected / updated
    public string OldValue { get; set; } = string.Empty;
    public string NewValue { get; set; } = string.Empty;
    public Guid ChangedBy { get; set; }
    public DateTimeOffset ChangedAt { get; set; }
}
