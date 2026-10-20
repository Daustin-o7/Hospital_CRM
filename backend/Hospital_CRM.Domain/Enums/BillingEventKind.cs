namespace Hospital_CRM.Domain.Enums;

/// <summary>
/// Provider-neutral subscription events. Each PSP adapter maps its own vocabulary
/// onto these; the lifecycle policy below only ever sees this enum.
/// </summary>
public enum BillingEventKind
{
    /// <summary>First successful payment / subscription becomes active.</summary>
    Activated,

    /// <summary>A renewal charge succeeded.</summary>
    Renewed,

    /// <summary>A charge failed; the provider is still retrying.</summary>
    PaymentFailed,

    /// <summary>Retries exhausted, the provider halted the subscription.</summary>
    Halted,

    /// <summary>Cancelled or completed; access runs to the paid period end.</summary>
    Cancelled
}
