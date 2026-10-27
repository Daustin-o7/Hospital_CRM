using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Immutable credit note issued against finalized invoices.
/// Enforces: Mistakes are corrected via Credit Notes, never by mutating finalized invoices.
/// Dual-control: amounts above ThresholdCreditNoteApproval require a second ClinicAdmin/Owner approval.
/// </summary>
public class CreditNote : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? ClinicId { get; set; }
    public Guid InvoiceId { get; set; }

    [MaxLength(50)]
    public string CreditNoteNumber { get; set; } = string.Empty; // e.g. CN-2026-27-000001

    [MaxLength(20)]
    public string FinancialYear { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Series { get; set; } = "CN";

    public int SequenceNumber { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;

    public Guid ApprovedByUserId { get; set; }
    public Guid? SecondApprovedByUserId { get; set; }

    public CreditNoteStatus Status { get; set; } = CreditNoteStatus.PendingApproval;

    public DateTimeOffset IssuedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual Invoice Invoice { get; set; } = null!;
    public virtual User ApprovedByUser { get; set; } = null!;
    public virtual User? SecondApprovedByUser { get; set; }
}
