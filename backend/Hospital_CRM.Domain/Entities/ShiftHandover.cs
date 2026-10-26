using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Structured handover note from one nurse to the next (continuity of care).
/// Structured fields replace free-text to prevent lost clinical instructions.
/// </summary>
public class ShiftHandover : ITenantScoped
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid PatientId { get; set; }
    public Guid AuthorNurseProfileId { get; set; }
    public Guid ToNurseProfileId { get; set; }
    public Guid? ShiftId { get; set; }

    [MaxLength(2000)]
    public string WhatHappened { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string WhatIsPending { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? CriticalAlerts { get; set; }

    // Legacy fallback
    public string Note
    {
        get => !string.IsNullOrEmpty(WhatHappened)
            ? $"Happened: {WhatHappened} | Pending: {WhatIsPending}" + (!string.IsNullOrEmpty(CriticalAlerts) ? $" | Alert: {CriticalAlerts}" : "")
            : _note;
        set => _note = value;
    }
    private string _note = string.Empty;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
