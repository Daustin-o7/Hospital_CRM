using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hospital_CRM.Domain.Entities;

public class Invoice
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid AppointmentId { get; set; }
    
    public int InvoiceNumber { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal Subtotal { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal GstAmount { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal Total { get; set; }
    
    public InvoiceStatus Status { get; set; }
    public string? IdempotencyKey { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; }
    
    // Navigation
    public virtual Appointment Appointment { get; set; } = null!;
    public virtual ICollection<Payment> Payments { get; set; } = [];
}