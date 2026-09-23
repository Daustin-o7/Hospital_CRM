namespace Hospital_CRM.Domain.Entities;

public class DispenseItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DispenseRecordId { get; set; }
    public Guid? PrescriptionItemId { get; set; }
    public Guid DrugBatchId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }

    public DispenseRecord? DispenseRecord { get; set; }
    public PrescriptionItem? PrescriptionItem { get; set; }
    public DrugBatch? DrugBatch { get; set; }
}
