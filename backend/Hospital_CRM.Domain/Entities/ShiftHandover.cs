namespace Hospital_CRM.Domain.Entities;

// Single free-text handover note from one nurse to the next (continuity of care).
public class ShiftHandover
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid PatientId { get; set; }
    public Guid AuthorNurseProfileId { get; set; }
    public Guid ToNurseProfileId { get; set; }
    public Guid? ShiftId { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}
