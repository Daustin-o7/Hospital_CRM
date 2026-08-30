namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// FR-14-04: Per-tenant feature flag. Minimal — only what MOD-14 needs. No general
/// flag infrastructure (TRD_Phase1 §10 explicitly deferred that).
/// </summary>
public class TenantFeatureFlag
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string FlagName { get; set; } = null!;   // e.g. "lab_records", "inventory", "finance_ledger"
    public bool Enabled { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Guid UpdatedBy { get; set; }
}
