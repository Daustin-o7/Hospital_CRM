using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Section 1: Atomic queue token counter per tenant, per doctor, per day in the clinic's local timezone.
/// Eliminates the read-then-write MaxToken(today)+1 race condition under high reception concurrency.
/// </summary>
public class DoctorDailyQueueCounter : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TenantId { get; set; }

    public Guid DoctorId { get; set; }

    public DateOnly Date { get; set; }

    public int LastToken { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public virtual User Doctor { get; set; } = null!;
}
