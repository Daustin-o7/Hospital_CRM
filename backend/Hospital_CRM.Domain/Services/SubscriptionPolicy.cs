using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Services;

/// <summary>
/// Pure subscription lifecycle access policy per Decision D3 / D5.
/// All timestamp evaluations are in UTC with zero side effects.
/// Default grace period is 3 days (D3).
/// </summary>
public static class SubscriptionPolicy
{
    public const int DefaultGraceDays = 3;

    public static EffectiveAccessLevel EffectiveAccess(
        SubscriptionStatus status,
        DateTimeOffset? endsAtUtc,
        DateTimeOffset nowUtc,
        int graceDays = DefaultGraceDays)
    {
        if (status == SubscriptionStatus.Suspended)
            return EffectiveAccessLevel.Blocked;

        if (status == SubscriptionStatus.Cancelled)
        {
            if (!endsAtUtc.HasValue)
                return EffectiveAccessLevel.Blocked;

            if (nowUtc <= endsAtUtc.Value)
                return EffectiveAccessLevel.Full;

            if (nowUtc <= endsAtUtc.Value.AddDays(graceDays))
                return EffectiveAccessLevel.ReadOnly;

            return EffectiveAccessLevel.Blocked;
        }

        if (status == SubscriptionStatus.PastDue)
        {
            if (!endsAtUtc.HasValue)
                return EffectiveAccessLevel.ReadOnly;

            if (nowUtc <= endsAtUtc.Value.AddDays(graceDays))
                return EffectiveAccessLevel.ReadOnly;

            return EffectiveAccessLevel.Blocked;
        }

        // Active or Trial
        if (!endsAtUtc.HasValue)
            return EffectiveAccessLevel.Full;

        if (nowUtc <= endsAtUtc.Value)
            return EffectiveAccessLevel.Full;

        if (nowUtc <= endsAtUtc.Value.AddDays(graceDays))
            return EffectiveAccessLevel.ReadOnly;

        return EffectiveAccessLevel.Blocked;
    }
}
