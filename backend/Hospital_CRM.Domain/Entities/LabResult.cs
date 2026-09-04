namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Versioned lab result — same amendment pattern as Consultation. A correction creates
/// a new row with PreviousVersionId pointing at the original; nothing is overwritten.
/// </summary>
public class LabResult
{
    public Guid Id { get; set; }
    public Guid LabOrderId { get; set; }
    public string? ResultText { get; set; }
    public string? FileUrl { get; set; }
    public int Version { get; set; } = 1;
    public Guid? PreviousVersionId { get; set; }
    public Guid EnteredBy { get; set; }
    public DateTimeOffset EnteredAt { get; set; }

    public virtual LabOrder LabOrder { get; set; } = null!;
    public virtual LabResult? PreviousVersion { get; set; }
    public virtual User EnteredByUser { get; set; } = null!;
}
