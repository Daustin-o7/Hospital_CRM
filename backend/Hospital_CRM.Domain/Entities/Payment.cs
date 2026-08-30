using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hospital_CRM.Domain.Entities;

public class Payment
{
    public Guid Id { get; set; }
    public Guid InvoiceId { get; set; }
    
    public PaymentMethod Method { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }
    
    [MaxLength(255)]
    public string? RazorpayPaymentId { get; set; }
    
    public PaymentStatus Status { get; set; }
    public string? IdempotencyKey { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? PaidAt { get; set; }

    // Navigation
    public virtual Invoice Invoice { get; set; } = null!;
}