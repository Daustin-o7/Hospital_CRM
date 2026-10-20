using System.Security.Cryptography;
using System.Text;

namespace Hospital_CRM.Api.Services;

/// <summary>
/// B2.9 device signature. The handset holds a per-device secret and signs
/// <c>deviceId \n timestampMs \n body</c>; the server recomputes it. This is what
/// separates a real paired phone from a browser that merely carries a clinic JWT.
/// </summary>
public static class DeviceSignature
{
    public const string Header = "X-Device-Signature";
    public const string DeviceHeader = "X-Device-Id";
    public const string TimestampHeader = "X-Device-Timestamp";

    /// <summary>Signals older than this are rejected; dedupe on event id stops replays inside the window.</summary>
    public static readonly TimeSpan MaxSkew = TimeSpan.FromMinutes(5);

    public static string Compute(string secret, string deviceId, long timestampMs, string body)
    {
        var message = $"{deviceId}\n{timestampMs}\n{body}";
        var hash = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(message));
        return Convert.ToHexStringLower(hash);
    }

    public static bool Verify(string secret, string deviceId, long timestampMs, string body, string signature)
    {
        var expected = Compute(secret, deviceId, timestampMs, body);
        var provided = signature.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase)
            ? signature[7..]
            : signature;

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(provided.Trim().ToLowerInvariant()));
    }

    public static bool IsFresh(long timestampMs, DateTimeOffset now)
    {
        var at = DateTimeOffset.FromUnixTimeMilliseconds(timestampMs);
        return (now - at).Duration() <= MaxSkew;
    }

    /// <summary>Six digits is short, so the code is single-use, expires and is attempt-limited.</summary>
    public static string NewPairingCode()
    {
        return RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
    }

    public static string HashPairingCode(string deviceId, string code)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"{deviceId}:{code}"));
        return Convert.ToHexStringLower(hash);
    }

    public static string NewSecret()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    }
}
