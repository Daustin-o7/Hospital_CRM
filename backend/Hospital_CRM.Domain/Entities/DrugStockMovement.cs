using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Append-only stock movement ledger for pharmacy batches.
/// Every receipt, dispense, return, adjustment, and write-off is logged as an immutable row.
/// Running batch quantity is strictly guarded by DB-level CHECK (QuantityRemaining >= 0).
/// </summary>
public class DrugStockMovement : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public Guid DrugId { get; set; }
    public Guid DrugBatchId { get; set; }

    /// <summary>
    /// Quantity in base units (e.g. tablets, capsules, ml, vials).
    /// </summary>
    public int Quantity { get; set; }

    public MovementDirection Direction { get; set; }

    /// <summary>
    /// e.g. StockIn, Dispense, Return, Adjustment, Recall, WriteOff
    /// </summary>
    public string ReferenceType { get; set; } = "StockIn";

    /// <summary>
    /// Foreign key link to DispenseRecordId, PurchaseOrderId, or InvoiceId
    /// </summary>
    public Guid? ReferenceId { get; set; }

    public string? Note { get; set; }

    public Guid RecordedBy { get; set; }
    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation properties
    public virtual Drug Drug { get; set; } = null!;
    public virtual DrugBatch DrugBatch { get; set; } = null!;
    public virtual User Recorder { get; set; } = null!;
}
