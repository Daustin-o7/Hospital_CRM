using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class LabOrder
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ConsultationId { get; set; }
    public Guid PatientId { get; set; }   // denormalized for fast worklist queries
    public Guid DoctorId { get; set; }    // denormalized for fast worklist queries
    public string TestName { get; set; } = null!;
    public string? Notes { get; set; }
    public LabOrderStatus Status { get; set; } = LabOrderStatus.Ordered;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public virtual Consultation Consultation { get; set; } = null!;
    public virtual Patient Patient { get; set; } = null!;
    public virtual User Doctor { get; set; } = null!;
    public virtual ICollection<LabResult> Results { get; set; } = [];
}
