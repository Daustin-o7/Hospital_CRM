using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class PatientDeposit : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? ClinicId { get; set; }
    public Guid PatientId { get; set; }

    [MaxLength(50)]
    public string ReceiptNumber { get; set; } = string.Empty;

    [MaxLength(10)]
    public string FinancialYear { get; set; } = string.Empty;

    public int SequenceNumber { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal AllocatedAmount { get; set; } = 0.0m;

    [Column(TypeName = "decimal(18,2)")]
    public decimal RefundedAmount { get; set; } = 0.0m;

    [Column(TypeName = "decimal(18,2)")]
    public decimal Balance { get; set; }

    public PaymentMethod Method { get; set; }

    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public PatientDepositStatus Status { get; set; } = PatientDepositStatus.Active;

    public Guid CollectedByUserId { get; set; }

    public string? IdempotencyKey { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual Patient Patient { get; set; } = null!;
    public virtual Clinic? Clinic { get; set; }
    public virtual ICollection<PatientDepositAllocation> Allocations { get; set; } = [];
}
