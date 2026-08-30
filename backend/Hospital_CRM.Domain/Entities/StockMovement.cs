using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Append-only. Every stock movement (in or out) is its own row — the running balance
/// is derived, never edited. Same audit principle as PatientAuditLog.
/// </summary>
public class StockMovement
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ItemId { get; set; }
    public int Quantity { get; set; }
    public MovementDirection Direction { get; set; }
    public string? Note { get; set; }
    public Guid RecordedBy { get; set; }
    public DateTimeOffset RecordedAt { get; set; }

    public virtual InventoryItem Item { get; set; } = null!;
    public virtual User Recorder { get; set; } = null!;
}
