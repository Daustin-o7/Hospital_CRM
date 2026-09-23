using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class Drug
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; } = Guid.Empty;
    public string Name { get; set; } = string.Empty;
    public string GenericName { get; set; } = string.Empty;
    public string TherapeuticCategory { get; set; } = string.Empty;
    public string DosageForm { get; set; } = "Tablet";
    public string Strength { get; set; } = string.Empty;
    public ScheduleClass ScheduleClass { get; set; } = ScheduleClass.General;
    public string HsnCode { get; set; } = "30049099";
    public decimal GstRate { get; set; } = 12m;
    public bool NlemCovered { get; set; } = false;
    public decimal? DpcoCeilingPrice { get; set; }
    public string StandardPackSize { get; set; } = "10 Tablets";
    public decimal IndicativeMrp { get; set; } = 0m;
    public string? CommonBrands { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<DrugBatch> Batches { get; set; } = new List<DrugBatch>();
}
