using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Configures tenant tax rules per clinic (confirmed with CA).
/// Under Notification 12/2017, OPD healthcare is exempt/nil-rated (0% GST, SAC 999312).
/// </summary>
public class TenantTaxProfile : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? ClinicId { get; set; }

    public bool IsGstRegistered { get; set; } = false;

    [MaxLength(15)]
    public string? Gstin { get; set; }

    [MaxLength(2)]
    public string? StateCode { get; set; } // e.g. "27" for Maharashtra, "29" for Karnataka

    public InvoiceDocumentType DocumentType { get; set; } = InvoiceDocumentType.BillOfSupply;

    public TaxCategory DefaultOpdTaxCategory { get; set; } = TaxCategory.Exempt;

    [MaxLength(20)]
    public string DefaultOpdHsnSac { get; set; } = "999312";

    [Column(TypeName = "decimal(5,2)")]
    public decimal DefaultOpdGstRate { get; set; } = 0.0m;

    [Column(TypeName = "decimal(18,2)")]
    public decimal ThresholdHighValueUtr { get; set; } = 2000.0m;

    [Column(TypeName = "decimal(18,2)")]
    public decimal ThresholdRefundApproval { get; set; } = 1000.0m;

    public int MaxUnconfirmedReportedPaymentsCount { get; set; } = 50;

    [Column(TypeName = "decimal(18,2)")]
    public decimal MaxUnconfirmedReportedPaymentsAmount { get; set; } = 100000.0m;

    public int StaffConfirmationSpikeThreshold { get; set; } = 20;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual Clinic? Clinic { get; set; }
}
