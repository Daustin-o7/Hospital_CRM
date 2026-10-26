using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Append-only print audit for invoices.
/// Enforces: First print is ORIGINAL; reprints increment count and watermark DUPLICATE COPY.
/// </summary>
public class InvoicePrintLog : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid InvoiceId { get; set; }

    public Guid PrintedByUserId { get; set; }
    public DateTimeOffset PrintedAt { get; set; } = DateTimeOffset.UtcNow;

    public int CopyNumber { get; set; } = 1;

    [MaxLength(50)]
    public string Watermark { get; set; } = "ORIGINAL";

    [MaxLength(50)]
    public string? IpAddress { get; set; }

    public virtual Invoice Invoice { get; set; } = null!;
    public virtual User PrintedByUser { get; set; } = null!;
}
