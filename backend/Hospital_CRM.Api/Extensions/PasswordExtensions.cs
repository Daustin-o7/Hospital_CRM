namespace Hospital_CRM.Api.Extensions;

/// <summary>
/// Unified password hashing and verification extension methods.
/// Enforces consistent work factor across all controllers and seed routines.
/// </summary>
public static class PasswordExtensions
{
    private const int DefaultWorkFactor = 12;

    public static string HashPassword(this string password, int workFactor = DefaultWorkFactor) =>
        BCrypt.Net.BCrypt.HashPassword(password, workFactor);

    public static bool VerifyPassword(this string password, string? passwordHash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(passwordHash))
            return false;

        return BCrypt.Net.BCrypt.Verify(password, passwordHash);
    }
}
