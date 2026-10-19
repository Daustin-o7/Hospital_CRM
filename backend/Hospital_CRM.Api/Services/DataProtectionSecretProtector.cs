using System.Security.Cryptography;
using Hospital_CRM.Domain.Services;
using Microsoft.AspNetCore.DataProtection;

namespace Hospital_CRM.Api.Services;

/// <summary>
/// Default <see cref="ISecretProtector"/>: ASP.NET Core Data Protection with keys on disk.
/// Keys live under <c>DataProtection:KeysPath</c>; mount that directory as a volume and
/// restrict it — losing the keys makes every stored tenant secret unreadable.
/// </summary>
public class DataProtectionSecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public DataProtectionSecretProtector(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("HospitalCrm.TenantIntegration.v1");
    }

    public string Protect(string plaintext) => _protector.Protect(plaintext);

    public string? Unprotect(string? protectedValue)
    {
        if (string.IsNullOrEmpty(protectedValue))
            return null;

        try
        {
            return _protector.Unprotect(protectedValue);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }
}
