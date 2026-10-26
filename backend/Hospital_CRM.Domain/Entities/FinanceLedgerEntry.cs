using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Append-only financial ledger entry.
/// Enforces database-level REVOKE UPDATE, DELETE FROM app_user.
/// All adjustments are recorded as new reversal entries.
/// </summary>
public class FinanceLedgerEntry : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? ClinicId { get; set; }

    public FinanceEntryType EntryType { get; set; }

    [MaxLength(50)]
    public string ReferenceType { get; set; } = string.Empty; // Invoice, Payment, CreditNote, Refund

    public Guid ReferenceId { get; set; }

    [MaxLength(64)]
    public string? ReferenceNumber { get; set; } // e.g. INV-2026-000001, UTR123456

    [MaxLength(50)]
    public string AccountCategory { get; set; } = string.Empty; // AccountsReceivable, ConsultationRevenue, Bank, Cash

    [Column(TypeName = "decimal(18,2)")]
    public decimal DebitAmount { get; set; } = 0.0m;

    [Column(TypeName = "decimal(18,2)")]
    public decimal CreditAmount { get; set; } = 0.0m;

    [MaxLength(500)]
    public string Narration { get; set; } = string.Empty;

    public Guid? PostedByUserId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
