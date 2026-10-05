using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class PatientNurseAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid PatientId { get; set; }
    public Guid NurseProfileId { get; set; }
    public Guid? AppointmentId { get; set; }
    public Guid? ShiftId { get; set; }

    public NurseAssignmentStatus Status { get; set; } = NurseAssignmentStatus.Active;
    public DateTimeOffset AssignedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public Guid AssignedBy { get; set; }

    public virtual NurseProfile Nurse { get; set; } = null!;
}
