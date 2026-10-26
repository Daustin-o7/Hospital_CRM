using System.Security.Cryptography;
using System.Text;

namespace Hospital_CRM.Api.Extensions;

/// <summary>
/// Refresh tokens are 256-bit random values, so a fast deterministic digest is safe and
/// lets the lookup use an index. BCrypt is for passwords only.
/// </summary>
public static class TokenHashExtensions
{
    public static string HashRefreshToken(this string rawToken) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}
