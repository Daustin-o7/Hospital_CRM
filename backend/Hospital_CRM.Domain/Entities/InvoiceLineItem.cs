using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hospital_CRM.Domain.Entities;

public class InvoiceLineItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InvoiceId { get; set; }

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    public int Quantity { get; set; } = 1;

    [Column(TypeName = "decimal(18,2)")]
    public decimal UnitPrice { get; set; } = 0m;

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    public decimal GstRate { get; set; } = 18m;
    public string? HsnCode { get; set; }
    public Guid? DrugBatchId { get; set; }

    // Navigation
    public virtual Invoice Invoice { get; set; } = null!;
    public virtual DrugBatch? DrugBatch { get; set; }
}
