using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Services;
using Xunit;

namespace Hospital_CRM.Tests;

public class SubscriptionPolicyTests
{
    private static readonly DateTimeOffset BaseTime = new(2026, 10, 19, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Suspended_Is_Always_Blocked_Even_If_Future_EndsAt()
    {
        var future = BaseTime.AddDays(30);
        var access = SubscriptionPolicy.EffectiveAccess(SubscriptionStatus.Suspended, future, BaseTime);
        Assert.Equal(EffectiveAccessLevel.Blocked, access);
    }

    [Fact]
    public void Suspended_Is_Always_Blocked_When_EndsAt_Null()
    {
        var access = SubscriptionPolicy.EffectiveAccess(SubscriptionStatus.Suspended, null, BaseTime);
        Assert.Equal(EffectiveAccessLevel.Blocked, access);
    }

    [Theory]
    [InlineData(SubscriptionStatus.Active)]
    [InlineData(SubscriptionStatus.Trial)]
    public void Active_And_Trial_With_Null_EndsAt_Are_Full_Access(SubscriptionStatus status)
    {
        var access = SubscriptionPolicy.EffectiveAccess(status, null, BaseTime);
        Assert.Equal(EffectiveAccessLevel.Full, access);
    }

    [Theory]
    // Exactly at endsAt -> Full
    [InlineData(SubscriptionStatus.Active, 0, EffectiveAccessLevel.Full)]
    [InlineData(SubscriptionStatus.Trial, 0, EffectiveAccessLevel.Full)]
    // 1 second before endsAt -> Full
    [InlineData(SubscriptionStatus.Active, -1, EffectiveAccessLevel.Full)]
    [InlineData(SubscriptionStatus.Trial, -1, EffectiveAccessLevel.Full)]
    // 1 second after endsAt -> ReadOnly (in 3-day grace period)
    [InlineData(SubscriptionStatus.Active, 1, EffectiveAccessLevel.ReadOnly)]
    [InlineData(SubscriptionStatus.Trial, 1, EffectiveAccessLevel.ReadOnly)]
    // Exactly 3 days (259200 seconds) after endsAt -> ReadOnly (grace period boundary inclusive)
    [InlineData(SubscriptionStatus.Active, 259200, EffectiveAccessLevel.ReadOnly)]
    [InlineData(SubscriptionStatus.Trial, 259200, EffectiveAccessLevel.ReadOnly)]
    // 1 second past grace period -> Blocked
    [InlineData(SubscriptionStatus.Active, 259201, EffectiveAccessLevel.Blocked)]
    [InlineData(SubscriptionStatus.Trial, 259201, EffectiveAccessLevel.Blocked)]
    // 10 days past endsAt -> Blocked
    [InlineData(SubscriptionStatus.Active, 864000, EffectiveAccessLevel.Blocked)]
    [InlineData(SubscriptionStatus.Trial, 864000, EffectiveAccessLevel.Blocked)]
    public void Boundary_Tests_For_Active_And_Trial(SubscriptionStatus status, int offsetSecondsFromEndsAt, EffectiveAccessLevel expected)
    {
        var endsAt = BaseTime;
        var now = endsAt.AddSeconds(offsetSecondsFromEndsAt);

        var actual = SubscriptionPolicy.EffectiveAccess(status, endsAt, now, graceDays: 3);
        Assert.Equal(expected, actual);
    }

    [Fact]
    public void PastDue_With_Null_EndsAt_Is_ReadOnly()
    {
        var access = SubscriptionPolicy.EffectiveAccess(SubscriptionStatus.PastDue, null, BaseTime);
        Assert.Equal(EffectiveAccessLevel.ReadOnly, access);
    }

    [Theory]
    // Before or at endsAt under PastDue -> ReadOnly
    [InlineData(0, EffectiveAccessLevel.ReadOnly)]
    [InlineData(-100, EffectiveAccessLevel.ReadOnly)]
    // During 3-day grace -> ReadOnly
    [InlineData(259200, EffectiveAccessLevel.ReadOnly)]
    // Past 3-day grace -> Blocked
    [InlineData(259201, EffectiveAccessLevel.Blocked)]
    public void Boundary_Tests_For_PastDue(int offsetSecondsFromEndsAt, EffectiveAccessLevel expected)
    {
        var endsAt = BaseTime;
        var now = endsAt.AddSeconds(offsetSecondsFromEndsAt);

        var actual = SubscriptionPolicy.EffectiveAccess(SubscriptionStatus.PastDue, endsAt, now, graceDays: 3);
        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Cancelled_With_Null_EndsAt_Is_Blocked()
    {
        var access = SubscriptionPolicy.EffectiveAccess(SubscriptionStatus.Cancelled, null, BaseTime);
        Assert.Equal(EffectiveAccessLevel.Blocked, access);
    }

    [Theory]
    // Mid-cycle cancellation: still before endsAt -> Full
    [InlineData(-10, EffectiveAccessLevel.Full)]
    [InlineData(0, EffectiveAccessLevel.Full)]
    // Grace period after endsAt -> ReadOnly
    [InlineData(10, EffectiveAccessLevel.ReadOnly)]
    [InlineData(259200, EffectiveAccessLevel.ReadOnly)]
    // Past grace -> Blocked
    [InlineData(259201, EffectiveAccessLevel.Blocked)]
    public void Boundary_Tests_For_Cancelled(int offsetSecondsFromEndsAt, EffectiveAccessLevel expected)
    {
        var endsAt = BaseTime;
        var now = endsAt.AddSeconds(offsetSecondsFromEndsAt);

        var actual = SubscriptionPolicy.EffectiveAccess(SubscriptionStatus.Cancelled, endsAt, now, graceDays: 3);
        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Custom_Grace_Period_Is_Respected()
    {
        var endsAt = BaseTime;
        var now4DaysLater = endsAt.AddDays(4);

        // With 3-day grace, 4 days is Blocked
        var defaultGrace = SubscriptionPolicy.EffectiveAccess(SubscriptionStatus.Active, endsAt, now4DaysLater, graceDays: 3);
        Assert.Equal(EffectiveAccessLevel.Blocked, defaultGrace);

        // With 7-day grace, 4 days is ReadOnly
        var customGrace = SubscriptionPolicy.EffectiveAccess(SubscriptionStatus.Active, endsAt, now4DaysLater, graceDays: 7);
        Assert.Equal(EffectiveAccessLevel.ReadOnly, customGrace);
    }
}
