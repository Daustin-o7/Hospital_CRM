namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// B2.9: a paired Android handset that observes bank SMS / soundbox notifications.
/// The device holds a secret the browser never sees and signs every signal it posts,
/// so a signed-in user cannot forge a receipt from the web console. A row starts
/// unpaired (pairing code only) and gets its secret when the clinic pairs the phone.
/// </summary>
public class PaymentBridgeDevice : ITenantScoped
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Set once the device is paired; null while the pairing code is outstanding.</summary>
    public string? SecretProtected { get; set; }

    /// <summary>SHA-256 of the six-digit pairing code. Never stored in the clear.</summary>
    public string? PairingCodeHash { get; set; }
    public DateTimeOffset? PairingExpiresAt { get; set; }
    public int PairingAttempts { get; set; }

    public DateTimeOffset? PairedAt { get; set; }
    public DateTimeOffset? LastSeenAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
