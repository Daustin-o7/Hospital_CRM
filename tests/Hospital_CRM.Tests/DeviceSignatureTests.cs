using Hospital_CRM.Api.Services;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>
/// B2.9 device signing. A clinic login alone must not be able to post a payment, so
/// the signature has to be exact: same body, same device, same secret, fresh clock.
/// </summary>
public class DeviceSignatureTests
{
    private const string Secret = "s3cr3t-for-device-1";
    private const string DeviceId = "6f1c0d4e-0b0f-4a2a-9d3e-2b8f0f7c1111";
    private const string Body = """{"eventId":"abc","amount":500.00}""";

    [Fact]
    public void RoundTripVerifies()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var signature = DeviceSignature.Compute(Secret, DeviceId, ts, Body);

        Assert.True(DeviceSignature.Verify(Secret, DeviceId, ts, Body, signature));
    }

    [Fact]
    public void TamperedBodyFails()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var signature = DeviceSignature.Compute(Secret, DeviceId, ts, Body);

        Assert.False(DeviceSignature.Verify(Secret, DeviceId, ts, Body.Replace("500.00", "5000.00"), signature));
    }

    [Fact]
    public void WrongSecretOrDeviceFails()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var signature = DeviceSignature.Compute(Secret, DeviceId, ts, Body);

        Assert.False(DeviceSignature.Verify("another-secret", DeviceId, ts, Body, signature));
        Assert.False(DeviceSignature.Verify(Secret, Guid.NewGuid().ToString(), ts, Body, signature));
    }

    [Fact]
    public void StaleTimestampIsRejected()
    {
        var stale = DateTimeOffset.UtcNow.Subtract(DeviceSignature.MaxSkew).Subtract(TimeSpan.FromSeconds(5));
        Assert.False(DeviceSignature.IsFresh(stale.ToUnixTimeMilliseconds(), DateTimeOffset.UtcNow));

        var fresh = DateTimeOffset.UtcNow.Subtract(TimeSpan.FromSeconds(10));
        Assert.True(DeviceSignature.IsFresh(fresh.ToUnixTimeMilliseconds(), DateTimeOffset.UtcNow));
    }

    [Fact]
    public void PrefixedSignatureIsAccepted()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var signature = DeviceSignature.Compute(Secret, DeviceId, ts, Body);

        Assert.True(DeviceSignature.Verify(Secret, DeviceId, ts, Body, "sha256=" + signature));
    }

    [Fact]
    public void PairingCodeIsSixDigitsAndBoundToTheDevice()
    {
        var code = DeviceSignature.NewPairingCode();

        Assert.Matches("^[0-9]{6}$", code);
        Assert.NotEqual(
            DeviceSignature.HashPairingCode("device-a", code),
            DeviceSignature.HashPairingCode("device-b", code));
    }

    [Fact]
    public void SecretsAreLongAndUnique()
    {
        var a = DeviceSignature.NewSecret();
        var b = DeviceSignature.NewSecret();

        Assert.True(Convert.FromBase64String(a).Length >= 32);
        Assert.NotEqual(a, b);
    }
}
