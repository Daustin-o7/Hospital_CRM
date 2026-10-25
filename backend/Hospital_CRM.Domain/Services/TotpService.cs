using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace Hospital_CRM.Domain.Services;

/// <summary>
/// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) so any standard authenticator app works.
/// Secrets are Base32 as those apps require; the stored copy is protected by ISecretProtector.
/// </summary>
public static class TotpService
{
    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private const int Digits = 6;
    private const int PeriodSeconds = 30;

    /// <summary>Emailed codes get a 5-minute window instead of 30 s.</summary>
    public const int EmailPeriodSeconds = 300;

    public static string GenerateSecret(int byteLength = 20) =>
        Base32Encode(RandomNumberGenerator.GetBytes(byteLength));

    public static string ComputeCode(string base32Secret, DateTimeOffset at, int periodSeconds = PeriodSeconds)
    {
        var key = Base32Decode(base32Secret);
        var counter = (ulong)(at.ToUnixTimeSeconds() / periodSeconds);

        Span<byte> counterBytes = stackalloc byte[8];
        BinaryPrimitives.WriteUInt64BigEndian(counterBytes, counter);

        var hash = HMACSHA1.HashData(key, counterBytes);
        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24)
                   | (hash[offset + 1] << 16)
                   | (hash[offset + 2] << 8)
                   | hash[offset + 3];

        return (binary % 1_000_000).ToString("D6");
    }

    /// <summary>Accepts one period either side to tolerate clock drift.</summary>
    public static bool Verify(string base32Secret, string? code, DateTimeOffset at, int skewSteps = 1, int periodSeconds = PeriodSeconds)
    {
        var normalized = code?.Trim().Replace(" ", string.Empty);
        if (normalized is null || normalized.Length != Digits || !normalized.All(char.IsAsciiDigit))
            return false;

        var candidate = Encoding.ASCII.GetBytes(normalized);
        for (var step = -skewSteps; step <= skewSteps; step++)
        {
            var expected = Encoding.ASCII.GetBytes(ComputeCode(base32Secret, at.AddSeconds(step * periodSeconds), periodSeconds));
            if (CryptographicOperations.FixedTimeEquals(expected, candidate))
                return true;
        }

        return false;
    }

    public static string BuildOtpAuthUri(string issuer, string account, string base32Secret) =>
        $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(account)}" +
        $"?secret={base32Secret}&issuer={Uri.EscapeDataString(issuer)}&algorithm=SHA1&digits={Digits}&period={PeriodSeconds}";

    private static string Base32Encode(byte[] data)
    {
        var output = new StringBuilder((data.Length * 8 + 4) / 5);
        int buffer = 0, bits = 0;

        foreach (var b in data)
        {
            buffer = (buffer << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                output.Append(Alphabet[(buffer >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }

        if (bits > 0)
            output.Append(Alphabet[(buffer << (5 - bits)) & 31]);

        return output.ToString();
    }

    private static byte[] Base32Decode(string input)
    {
        var clean = input.Trim().TrimEnd('=').Replace(" ", string.Empty).ToUpperInvariant();
        var output = new List<byte>(clean.Length * 5 / 8);
        int buffer = 0, bits = 0;

        foreach (var c in clean)
        {
            var index = Alphabet.IndexOf(c);
            if (index < 0)
                throw new FormatException("Invalid base32 secret.");

            buffer = (buffer << 5) | index;
            bits += 5;
            if (bits >= 8)
            {
                output.Add((byte)((buffer >> (bits - 8)) & 0xFF));
                bits -= 8;
            }
        }

        return output.ToArray();
    }
}
