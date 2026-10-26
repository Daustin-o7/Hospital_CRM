using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class DrugBatch : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid DrugId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public DateOnly ExpiryDate { get; set; }
    public DateOnly? MfgDate { get; set; }
    public int QuantityReceived { get; set; }
    public int QuantityRemaining { get; set; }
    public decimal Mrp { get; set; }
    public decimal PurchaseRate { get; set; }
    public Guid? SupplierId { get; set; }
    public string? InvoiceNumber { get; set; }
    public DateOnly? InvoiceDate { get; set; }

    /// <summary>Supplier's own Form 20/21 wholesale licence, captured for drug-inspector audits.</summary>
    [MaxLength(50)]
    public string? SupplierLicenceNumber { get; set; }
    public string? PackSize { get; set; } = "10 Tablets";
    public int BaseUnitQuantity { get; set; } = 1;
    public bool IsRecalled { get; set; } = false;
    public string? RecallReason { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    [ConcurrencyCheck]
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Drug? Drug { get; set; }
    public Supplier? Supplier { get; set; }
}
