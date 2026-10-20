using Hospital_CRM.Domain.Services;
using Xunit;

namespace Hospital_CRM.Tests;

public class TotpServiceTests
{
    // RFC 6238 Appendix B: the ASCII secret "12345678901234567890".
    private const string RfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    [Theory]
    [InlineData(59, "287082")]
    [InlineData(1111111109, "081804")]
    [InlineData(1234567890, "005924")]
    public void Matches_Rfc6238_Vectors(long unixSeconds, string expected)
    {
        var at = DateTimeOffset.FromUnixTimeSeconds(unixSeconds);
        Assert.Equal(expected, TotpService.ComputeCode(RfcSecret, at));
    }

    [Fact]
    public void Verify_Accepts_Current_And_One_Adjacent_Step()
    {
        var at = DateTimeOffset.FromUnixTimeSeconds(1111111111);
        var code = TotpService.ComputeCode(RfcSecret, at);

        Assert.True(TotpService.Verify(RfcSecret, code, at));
        Assert.True(TotpService.Verify(RfcSecret, code, at.AddSeconds(29)));
        Assert.False(TotpService.Verify(RfcSecret, code, at.AddSeconds(-90)));
        Assert.False(TotpService.Verify(RfcSecret, "12345", at));
        Assert.False(TotpService.Verify(RfcSecret, "abcdef", at));
    }

    [Fact]
    public void Generated_Secret_Is_Base32_And_RoundTrips()
    {
        var secret = TotpService.GenerateSecret();

        Assert.Matches("^[A-Z2-7]+$", secret);
        var code = TotpService.ComputeCode(secret, DateTimeOffset.UtcNow);
        Assert.True(TotpService.Verify(secret, code, DateTimeOffset.UtcNow));
    }

    [Fact]
    public void OtpAuthUri_Carries_Issuer_And_Secret()
    {
        var uri = TotpService.BuildOtpAuthUri("SAMSTACK Care", "admin@example.com", "ABCDEF");

        Assert.StartsWith("otpauth://totp/SAMSTACK%20Care:admin%40example.com?", uri);
        Assert.Contains("secret=ABCDEF", uri);
    }
}
