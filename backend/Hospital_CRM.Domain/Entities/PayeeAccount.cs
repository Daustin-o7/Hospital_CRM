using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Clinic payee bank account or UPI VPA for direct patient-to-clinic payment capture.
/// Money never passes through an intermediate aggregator or platform escrow.
/// </summary>
public class PayeeAccount : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid? ClinicId { get; set; }

    [MaxLength(255)]
    public string AccountHolderName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Vpa { get; set; } = string.Empty; // e.g. clinic@okhdfcbank

    [MaxLength(100)]
    public string BankName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string AccountNumberMasked { get; set; } = string.Empty; // e.g. ****5678

    [MaxLength(20)]
    public string IfscCode { get; set; } = string.Empty;

    /// <summary>1 = Primary account, 2 = Secondary/Backup account</summary>
    public int PriorityOrder { get; set; } = 1;

    [Column(TypeName = "decimal(18,2)")]
    public decimal DailyLimit { get; set; } = 100000.0m;

    [Column(TypeName = "decimal(18,2)")]
    public decimal DailyCollected { get; set; } = 0.0m;

    public bool IsActive { get; set; } = true;

    /// <summary>
    /// 24-hour cooling-off window after addition or edit before receiving live QR traffic.
    /// Protects against compromised accounts hijacking settlement VPAs.
    /// </summary>
    public DateTimeOffset? CoolingOffUntil { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public virtual Clinic? Clinic { get; set; }
    public virtual ICollection<Payment> Payments { get; set; } = [];
}
