namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// B2: per-tenant payment / messaging integration. One row per provider per tenant.
/// <see cref="SecretProtected"/> is encrypted with <c>ISecretProtector</c> and is never
/// returned by any API — the connect screen only ever sees the webhook URL.
/// </summary>
public class TenantIntegration : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>"paytm", "phonepe", "razorpay" or "whatsapp".</summary>
    public string Provider { get; set; } = string.Empty;

    /// <summary>PSP merchant id, or the WhatsApp phone-number id. Not secret.</summary>
    public string? MerchantId { get; set; }

    /// <summary>Encrypted webhook secret / access token. Never returned or logged.</summary>
    public string? SecretProtected { get; set; }

    /// <summary>Unguessable path segment used to route the webhook to this tenant.</summary>
    public string WebhookPathToken { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;
    public DateTimeOffset? LastVerifiedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
