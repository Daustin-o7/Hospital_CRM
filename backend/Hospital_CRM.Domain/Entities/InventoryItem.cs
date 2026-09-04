using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class InventoryItem
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = null!;
    public InventoryTier Tier { get; set; }
    public string Unit { get; set; } = null!;       // e.g. "box", "bottle", "piece"
    public bool Active { get; set; } = true;        // soft-delete: historical movements must still reference this
    public int LowStockThreshold { get; set; } = 0; // for FR-09-03 low-stock report (0 = disabled)
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    public virtual ICollection<StockMovement> Movements { get; set; } = [];
}
