using System.ComponentModel.DataAnnotations;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class Tenant
{
    public Guid Id { get; set; }

    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;

    public SubscriptionTier SubscriptionTier { get; set; } = SubscriptionTier.Trial;

    public SubscriptionStatus SubscriptionStatus { get; set; } = SubscriptionStatus.Trial;

    /// <summary>
    /// Comma-separated list of enabled modules for this tenant entitlement (e.g. "core,pharmacy").
    /// Canonical parse/serialize/validate is via <see cref="Hospital_CRM.Domain.Constants.ModuleRegistry"/>.
    /// </summary>
    [MaxLength(1000)]
    public string ActivatedModules { get; set; } = "core";

    public DateTimeOffset? SubscriptionEndsAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    // Navigation
    public Clinic? Clinic { get; set; }
}
