using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class PurchaseOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; } = Guid.Empty;
    public Guid? SupplierId { get; set; }
    public string DistributorName { get; set; } = string.Empty;
    public string OrderNumber { get; set; } = string.Empty;
    public string ItemsJson { get; set; } = "[]";
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;
    public Guid CreatedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Supplier? Supplier { get; set; }
    public User? Creator { get; set; }
}
