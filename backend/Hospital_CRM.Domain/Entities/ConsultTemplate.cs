namespace Hospital_CRM.Domain.Entities;

public class ConsultTemplate
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? DoctorId { get; set; } // null = built-in default for the specialty
    public string Specialty { get; set; } = null!;
    public string Name { get; set; } = null!;

    /// <summary>JSON structure: { sections: [{ key, label, type, placeholder? }] }</summary>
    public string StructureJson { get; set; } = "{}";

    public bool IsBuiltIn { get; set; } // true = shipped default, false = doctor-custom
    public DateTimeOffset CreatedAt { get; set; }
}
