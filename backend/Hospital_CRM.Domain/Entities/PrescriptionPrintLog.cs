namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Audit log of every print or reprint of an external prescription.
/// First print is marked original; subsequent prints are marked as DUPLICATE COPY.
/// </summary>
public class PrescriptionPrintLog : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    public Guid ConsultationId { get; set; }
    public Guid PrescriptionId { get; set; }

    public int PrintCount { get; set; } = 1;
    public bool IsDuplicateCopy { get; set; } = false;

    public Guid PrintedByUserId { get; set; }
    public DateTimeOffset PrintedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual Consultation Consultation { get; set; } = null!;
    public virtual Prescription Prescription { get; set; } = null!;
    public virtual User PrintedByUser { get; set; } = null!;
}
