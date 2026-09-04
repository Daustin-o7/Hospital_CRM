namespace Hospital_CRM.Domain.Entities;

public class DrugBatch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; } = Guid.Empty;
    public Guid DrugId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public DateOnly ExpiryDate { get; set; }
    public DateOnly? MfgDate { get; set; }
    public int QuantityReceived { get; set; }
    public int QuantityRemaining { get; set; }
    public decimal Mrp { get; set; }
    public decimal PurchaseRate { get; set; }
    public Guid? SupplierId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Drug? Drug { get; set; }
    public Supplier? Supplier { get; set; }
}
