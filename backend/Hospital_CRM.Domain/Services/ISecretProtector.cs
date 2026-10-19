namespace Hospital_CRM.Domain.Services;

/// <summary>
/// Protects per-tenant integration secrets at rest. The shipped implementation uses
/// ASP.NET Core Data Protection; an Azure Key Vault implementation can replace it
/// without touching any call site.
/// </summary>
public interface ISecretProtector
{
    string Protect(string plaintext);

    /// <summary>Returns null when the value is missing or cannot be unprotected (e.g. rotated keys).</summary>
    string? Unprotect(string? protectedValue);
}
