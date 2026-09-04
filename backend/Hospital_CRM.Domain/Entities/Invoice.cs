using Hospital_CRM.Domain.Enums;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hospital_CRM.Domain.Entities;

public class Invoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; } = Guid.Empty;
    public Guid? AppointmentId { get; set; }
    public Guid? PatientId { get; set; }
    public InvoiceType InvoiceType { get; set; } = InvoiceType.Consultation;
    public string? WalkInCustomerName { get; set; }
    public string? WalkInCustomerPhone { get; set; }
    
    public int InvoiceNumber { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal Subtotal { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal GstAmount { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal Total { get; set; }
    
    public InvoiceStatus Status { get; set; }
    public string? IdempotencyKey { get; set; }
    
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    
    // Navigation
    public virtual Appointment? Appointment { get; set; }
    public virtual Patient? Patient { get; set; }
    public virtual ICollection<InvoiceLineItem> LineItems { get; set; } = [];
    public virtual ICollection<Payment> Payments { get; set; } = [];
}