using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Hospital_CRM.Domain.Enums;

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

    public decimal GstRate { get; set; } = 0.0m;
    public TaxCategory TaxCategory { get; set; } = TaxCategory.Exempt;

    [MaxLength(20)]
    public string HsnSacCode { get; set; } = "999312";

    [Column(TypeName = "decimal(18,2)")]
    public decimal TaxAmount { get; set; } = 0.0m;

    [Column(TypeName = "decimal(18,2)")]
    public decimal DiscountAmount { get; set; } = 0.0m;

    public string? HsnCode { get; set; }
    public Guid? DrugBatchId { get; set; }


    // Navigation
    public virtual Invoice Invoice { get; set; } = null!;
    public virtual DrugBatch? DrugBatch { get; set; }
}
