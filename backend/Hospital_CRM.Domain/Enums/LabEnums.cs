namespace Hospital_CRM.Domain.Enums;

public enum LabOrderStatus
{
    Ordered = 0,
    SampleCollected = 1,
    Resulted = 2,
    ReviewedByDoctor = 3,
    Completed = 4,
    Cancelled = 5
}
