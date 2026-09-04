using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class LedgerExpense
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public ExpenseCategory Category { get; set; }
    public string CategoryOther { get; set; } = null!; // populated when Category=Other (text label)
    public decimal Amount { get; set; }
    public DateOnly ExpenseDate { get; set; }
    public string? Note { get; set; }
    public Guid RecordedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? EditedAt { get; set; }

    public virtual User Recorder { get; set; } = null!;
}
