namespace Hospital_CRM.Domain.Entities;

public class PriorityLog
{
    public Guid Id { get; set; }
    public Guid AppointmentId { get; set; }
    public Guid ChangedBy { get; set; }
    public string ChangedTo { get; set; } = null!; // "emergency" or "normal"
    public DateTimeOffset ChangedAt { get; set; }

    public virtual Appointment Appointment { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}
