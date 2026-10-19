using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Services;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>
/// B4 acceptance: the whole trial → paid → past due → suspended → reactivated cycle,
/// driven only by provider events and the A4 policy, with no PSP account.
/// </summary>
public class SubscriptionLifecycleTests
{
    private static readonly Guid TenantId = Guid.Parse("eed0cdc5-fb8d-419e-b7ed-e7fc26a7b8a4");

    private static string RazorpayEvent(string eventName, long? currentEnd = 1_763_000_000, Guid? tenant = null)
    {
        var notes = tenant.HasValue ? $"{{\"tenant_id\":\"{tenant}\"}}" : "[]";
        var currentEndJson = currentEnd.HasValue ? currentEnd.Value.ToString() : "null";
        return $$"""
        {
          "entity": "event",
          "event": "{{eventName}}",
          "payload": {
            "subscription": {
              "entity": {
                "id": "sub_TEST123",
                "status": "active",
                "current_end": {{currentEndJson}},
                "notes": {{notes}}
              }
            }
          }
        }
        """;
    }

    [Theory]
    [InlineData("subscription.authenticated", BillingEventKind.Activated)]
    [InlineData("subscription.activated", BillingEventKind.Activated)]
    [InlineData("subscription.charged", BillingEventKind.Renewed)]
    [InlineData("subscription.resumed", BillingEventKind.Renewed)]
    [InlineData("subscription.pending", BillingEventKind.PaymentFailed)]
    [InlineData("subscription.halted", BillingEventKind.Halted)]
    [InlineData("subscription.cancelled", BillingEventKind.Cancelled)]
    [InlineData("subscription.completed", BillingEventKind.Cancelled)]
    public void Parse_maps_razorpay_events(string eventName, BillingEventKind expected)
    {
        var parsed = SubscriptionLifecycle.Parse("razorpay", RazorpayEvent(eventName, tenant: TenantId));

        Assert.NotNull(parsed);
        Assert.Equal(expected, parsed!.Kind);
        Assert.Equal(TenantId, parsed.TenantId);
        Assert.Equal("sub_TEST123", parsed.ProviderSubscriptionId);
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(1_763_000_000), parsed.PaidPeriodEndsAt);
    }

    [Theory]
    [InlineData("subscription.updated")]
    [InlineData("subscription.paused")]
    [InlineData("payment.captured")]
    public void Parse_ignores_events_that_do_not_change_access(string eventName)
    {
        Assert.Null(SubscriptionLifecycle.Parse("razorpay", RazorpayEvent(eventName, tenant: TenantId)));
    }

    [Fact]
    public void Parse_returns_null_for_unknown_provider_or_bad_body()
    {
        Assert.Null(SubscriptionLifecycle.Parse("stripe", RazorpayEvent("subscription.charged", tenant: TenantId)));
        Assert.Null(SubscriptionLifecycle.Parse("razorpay", "{ not json"));
    }

    [Fact]
    public void Parse_leaves_tenant_null_when_the_subscription_carries_no_note()
    {
        var parsed = SubscriptionLifecycle.Parse("razorpay", RazorpayEvent("subscription.charged"));

        Assert.NotNull(parsed);
        Assert.Null(parsed!.TenantId);
    }

    [Fact]
    public void Full_cycle_trial_paid_past_due_suspended_reactivated()
    {
        var periodEnd = DateTimeOffset.FromUnixTimeSeconds(1_763_000_000);
        var now = periodEnd.AddDays(-1);

        // Trial, nothing paid yet.
        var status = SubscriptionStatus.Trial;
        DateTimeOffset? endsAt = null;
        Assert.Equal(EffectiveAccessLevel.Full, SubscriptionPolicy.EffectiveAccess(status, endsAt, now));

        // Paid: the plan is activated.
        var activated = SubscriptionLifecycle.Parse("razorpay", RazorpayEvent("subscription.activated", tenant: TenantId))!;
        (status, endsAt) = SubscriptionLifecycle.Transition(activated, endsAt);
        Assert.Equal(SubscriptionStatus.Active, status);
        Assert.Equal(periodEnd, endsAt);
        Assert.Equal(EffectiveAccessLevel.Full, SubscriptionPolicy.EffectiveAccess(status, endsAt, now));

        // A renewal charge fails: PastDue. Access drops to read-only from that moment
        // and the paid period end still drives the 3-day grace, so the provider's own
        // grace window (current_end of the unpaid period) is never trusted.
        var pending = SubscriptionLifecycle.Parse("razorpay", RazorpayEvent("subscription.pending", currentEnd: 1_765_600_000, tenant: TenantId))!;
        (status, endsAt) = SubscriptionLifecycle.Transition(pending, endsAt);
        Assert.Equal(SubscriptionStatus.PastDue, status);
        Assert.Equal(periodEnd, endsAt);
        Assert.Equal(EffectiveAccessLevel.ReadOnly, SubscriptionPolicy.EffectiveAccess(status, endsAt, now));

        // D3: three days of read-only after the paid period, then blocked.
        Assert.Equal(EffectiveAccessLevel.ReadOnly,
            SubscriptionPolicy.EffectiveAccess(status, endsAt, periodEnd.AddDays(1)));
        Assert.Equal(EffectiveAccessLevel.Blocked,
            SubscriptionPolicy.EffectiveAccess(status, endsAt, periodEnd.AddDays(4)));

        // Retries exhausted: Suspended, blocked immediately.
        var halted = SubscriptionLifecycle.Parse("razorpay", RazorpayEvent("subscription.halted", tenant: TenantId))!;
        (status, endsAt) = SubscriptionLifecycle.Transition(halted, endsAt);
        Assert.Equal(SubscriptionStatus.Suspended, status);
        Assert.Equal(EffectiveAccessLevel.Blocked,
            SubscriptionPolicy.EffectiveAccess(status, endsAt, periodEnd.AddDays(30)));

        // The customer pays and the provider reactivates: back to Active for a new period.
        var newPeriodEnd = DateTimeOffset.FromUnixTimeSeconds(1_765_600_000);
        var charged = SubscriptionLifecycle.Parse("razorpay", RazorpayEvent("subscription.charged", currentEnd: 1_765_600_000, tenant: TenantId))!;
        (status, endsAt) = SubscriptionLifecycle.Transition(charged, endsAt);
        Assert.Equal(SubscriptionStatus.Active, status);
        Assert.Equal(newPeriodEnd, endsAt);
        Assert.Equal(EffectiveAccessLevel.Full,
            SubscriptionPolicy.EffectiveAccess(status, endsAt, newPeriodEnd.AddDays(-1)));
    }

    [Fact]
    public void Cancellation_keeps_access_until_the_paid_period_ends()
    {
        var periodEnd = DateTimeOffset.FromUnixTimeSeconds(1_763_000_000);

        var cancelled = SubscriptionLifecycle.Parse("razorpay", RazorpayEvent("subscription.cancelled", tenant: TenantId))!;
        var (status, endsAt) = SubscriptionLifecycle.Transition(cancelled, periodEnd.AddDays(-10));

        Assert.Equal(SubscriptionStatus.Cancelled, status);
        Assert.Equal(periodEnd, endsAt);
        Assert.Equal(EffectiveAccessLevel.Full, SubscriptionPolicy.EffectiveAccess(status, endsAt, periodEnd.AddDays(-1)));
        Assert.Equal(EffectiveAccessLevel.ReadOnly, SubscriptionPolicy.EffectiveAccess(status, endsAt, periodEnd.AddDays(2)));
        Assert.Equal(EffectiveAccessLevel.Blocked, SubscriptionPolicy.EffectiveAccess(status, endsAt, periodEnd.AddDays(5)));
    }

    [Fact]
    public void Replayed_renewal_is_idempotent()
    {
        var first = SubscriptionLifecycle.Parse("razorpay", RazorpayEvent("subscription.charged", tenant: TenantId))!;

        var once = SubscriptionLifecycle.Transition(first, null);
        var twice = SubscriptionLifecycle.Transition(first, once.EndsAt);

        Assert.Equal(once, twice);
    }
}
