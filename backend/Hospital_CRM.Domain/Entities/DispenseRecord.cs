namespace Hospital_CRM.Domain.Entities;

public class DispenseRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; } = Guid.Empty;
    public Guid? PrescriptionId { get; set; }
    public Guid? PatientId { get; set; }
    public string? WalkInCustomerName { get; set; }
    public Guid DispensedBy { get; set; }
    public DateTimeOffset DispensedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? IdempotencyKey { get; set; }

    public User? Dispenser { get; set; }
    public Prescription? Prescription { get; set; }
    public Patient? Patient { get; set; }
    public ICollection<DispenseItem> Items { get; set; } = new List<DispenseItem>();
}
