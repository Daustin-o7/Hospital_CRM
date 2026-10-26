namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Logs autocomplete searches that returned zero results.
/// Informs the clinic/pharmacist which drugs and local brands to curate next.
/// </summary>
public class MedicineSearchMissLog : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public string Query { get; set; } = string.Empty;
    public Guid SearchedByUserId { get; set; }
    public DateTimeOffset SearchedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual User SearchedByUser { get; set; } = null!;
}
