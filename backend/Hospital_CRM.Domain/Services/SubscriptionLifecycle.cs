using System.Text.Json;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Services;

/// <summary>A subscription event normalised away from any one provider's vocabulary.</summary>
public sealed record BillingEvent(
    BillingEventKind Kind,
    Guid? TenantId,
    string? ProviderSubscriptionId,
    DateTimeOffset? PaidPeriodEndsAt);

/// <summary>
/// B4: maps a provider's subscription webhook onto <see cref="BillingEventKind"/> and
/// drives the A4 state machine. Pure and side-effect free so the whole dunning cycle
/// is testable without a PSP account.
///
/// Dunning (D3): a failed charge moves the tenant to PastDue and leaves
/// SubscriptionEndsAt alone, so <see cref="SubscriptionPolicy"/> grants the 3-day
/// read-only grace from the end of the period that was actually paid for. The
/// provider's own grace window is not trusted for access decisions.
/// </summary>
public static class SubscriptionLifecycle
{
    /// <summary>
    /// Parses a webhook body. Returns null for malformed JSON, an unknown provider, or
    /// an event that does not affect access (updated/paused and friends), so callers
    /// can acknowledge and ignore it.
    /// </summary>
    public static BillingEvent? Parse(string provider, string body)
    {
        return provider?.Trim().ToLowerInvariant() switch
        {
            "razorpay" => ParseRazorpay(body),
            _ => null
        };
    }

    /// <summary>
    /// The next state for a tenant. A pure function of the event and the tenant's
    /// current status, so a replayed or out-of-order delivery converges.
    /// </summary>
    public static (SubscriptionStatus Status, DateTimeOffset? EndsAt) Transition(
        BillingEvent billingEvent,
        DateTimeOffset? currentEndsAt)
    {
        return billingEvent.Kind switch
        {
            BillingEventKind.Activated or BillingEventKind.Renewed =>
                (SubscriptionStatus.Active, billingEvent.PaidPeriodEndsAt ?? currentEndsAt),

            BillingEventKind.PaymentFailed =>
                (SubscriptionStatus.PastDue, currentEndsAt),

            BillingEventKind.Halted =>
                (SubscriptionStatus.Suspended, currentEndsAt),

            _ =>
                (SubscriptionStatus.Cancelled, billingEvent.PaidPeriodEndsAt ?? currentEndsAt)
        };
    }

    private static BillingEvent? ParseRazorpay(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            var kind = GetString(root, "event") switch
            {
                "subscription.authenticated" => BillingEventKind.Activated,
                "subscription.activated" => BillingEventKind.Activated,
                "subscription.charged" => BillingEventKind.Renewed,
                "subscription.resumed" => BillingEventKind.Renewed,
                "subscription.pending" => BillingEventKind.PaymentFailed,
                "subscription.halted" => BillingEventKind.Halted,
                "subscription.cancelled" => BillingEventKind.Cancelled,
                "subscription.completed" => BillingEventKind.Cancelled,
                _ => (BillingEventKind?)null
            };

            if (kind is null) return null;

            if (!root.TryGetProperty("payload", out var payload) ||
                !payload.TryGetProperty("subscription", out var wrapper) ||
                !wrapper.TryGetProperty("entity", out var subscription))
                return null;

            // The tenant cannot come from a claim on an anonymous webhook, so the
            // subscription is created with notes.tenant_id.
            Guid? tenantId = null;
            if (subscription.TryGetProperty("notes", out var notes) && notes.ValueKind == JsonValueKind.Object)
            {
                var raw = GetString(notes, "tenant_id");
                if (Guid.TryParse(raw, out var parsed)) tenantId = parsed;
            }

            // current_end is the end of the period the event settled; end_at is the
            // whole subscription term. The narrower one governs access.
            var periodEnd = GetUnixSeconds(subscription, "current_end")
                            ?? GetUnixSeconds(subscription, "end_at");

            return new BillingEvent(kind.Value, tenantId, GetString(subscription, "id"), periodEnd);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? GetString(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static DateTimeOffset? GetUnixSeconds(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Number
            && value.TryGetInt64(out var seconds)
                ? DateTimeOffset.FromUnixTimeSeconds(seconds)
                : null;
}
