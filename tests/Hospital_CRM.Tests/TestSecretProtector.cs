using Hospital_CRM.Domain.Services;

namespace Hospital_CRM.Tests;

/// <summary>Deterministic stand-in for Data Protection so auth tests can round-trip secrets.</summary>
internal sealed class TestSecretProtector : ISecretProtector
{
    private const string Prefix = "test-protected:";

    public string Protect(string plaintext) => Prefix + plaintext;

    public string? Unprotect(string? protectedValue) =>
        protectedValue is not null && protectedValue.StartsWith(Prefix, StringComparison.Ordinal)
            ? protectedValue[Prefix.Length..]
            : null;
}
