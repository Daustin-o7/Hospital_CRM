using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class ControlledSubstanceRegister
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; } = Guid.Empty;
    public Guid? DispenseRecordId { get; set; }
    public Guid? InvoiceId { get; set; }
    public Guid DrugId { get; set; }
    public ScheduleClass ScheduleClass { get; set; }
    public string DrugName { get; set; } = string.Empty;
    public string BatchNumber { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientAddress { get; set; } = string.Empty;
    public string PrescriberName { get; set; } = string.Empty;
    public string PrescriberRegNo { get; set; } = string.Empty;
    public Guid DispensedBy { get; set; }
    public string DispenserName { get; set; } = string.Empty;
    public DateTimeOffset DispensedAt { get; set; } = DateTimeOffset.UtcNow;

    public Drug? Drug { get; set; }
    public DispenseRecord? DispenseRecord { get; set; }
    public Invoice? Invoice { get; set; }
}
