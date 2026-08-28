using System.Security.Cryptography;
using Azure.Core;
using Azure.Identity;
using Azure.Security.KeyVault.Keys;
using Azure.Security.KeyVault.Keys.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Hospital_CRM.Api.Services;

public class AzureKeyVaultKeyService : IPersistentKeyService
{
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AzureKeyVaultKeyService> _logger;

    private Azure.Security.KeyVault.Keys.JsonWebKey? _jwk;
    private RSA? _publicRsa;
    private CryptographyClient? _cryptoClient;
    private string? _keyId;

    public string KeySource => "AzureKeyVault";

    public AzureKeyVaultKeyService(IConfiguration config, IWebHostEnvironment env, ILogger<AzureKeyVaultKeyService> logger)
    {
        _config = config;
        _env = env;
        _logger = logger;
    }

    public async Task LoadAsync(CancellationToken ct = default)
    {
        var vaultUrl = _config["Jwt:AzureKeyVault:Url"]
            ?? throw new InvalidOperationException("Jwt:AzureKeyVault:Url is required when KeySource is AzureKeyVault.");
        var keyName = _config["Jwt:AzureKeyVault:KeyName"]
            ?? throw new InvalidOperationException("Jwt:AzureKeyVault:KeyName is required when KeySource is AzureKeyVault.");

        var credential = new DefaultAzureCredential(new DefaultAzureCredentialOptions
        {
            ExcludeEnvironmentCredential = _env.IsDevelopment(),
            ExcludeAzureCliCredential = !_env.IsDevelopment(),
            ExcludeVisualStudioCredential = !_env.IsDevelopment()
        });

        var keyClient = new KeyClient(new Uri(vaultUrl), credential);
        _cryptoClient = new CryptographyClient(new Uri($"{vaultUrl.TrimEnd('/')}/keys/{keyName}"), credential);

        KeyVaultKey vaultKey;
        try
        {
            vaultKey = await keyClient.GetKeyAsync(keyName, cancellationToken: ct);
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"Failed to load signing key '{keyName}' from Azure Key Vault '{vaultUrl}'. " +
                "Ensure the key exists, Managed Identity has Key Vault GET and sign permissions, and the vault URL is correct.", ex);
        }

        _jwk = vaultKey.Key;
        _keyId = _config["Jwt:KeyId"] ?? vaultKey.Properties.Version ?? "hospital-crm-rsa-key-1";

        _publicRsa = _jwk.ToRSA(false);

        _logger.LogInformation(
            "Loaded RS256 key '{KeyName}' from Azure Key Vault (kid={Kid}, vault={VaultUrl})",
            keyName, _keyId, vaultUrl);
    }

    public RsaSecurityKey GetPrivateKey() =>
        throw new NotSupportedException(
            "AzureKeyVaultKeyService does not expose the private key. Use SignAsync() for signing — the private key never leaves the vault.");

    public RsaSecurityKey GetPublicKey()
    {
        if (_publicRsa == null || _keyId == null)
            throw new InvalidOperationException("Key not loaded. Call LoadAsync() at startup.");
        var parameters = _publicRsa.ExportParameters(false);
        return new RsaSecurityKey(parameters) { KeyId = _keyId };
    }

    public async Task<byte[]> SignAsync(byte[] data, CancellationToken ct = default)
    {
        if (_cryptoClient == null)
            throw new InvalidOperationException("Key not loaded. Call LoadAsync() at startup.");
        var result = await _cryptoClient.SignAsync(SignatureAlgorithm.RS256, data, ct);
        return result.Signature;
    }

    public object GetJwks()
    {
        if (_jwk == null || _keyId == null)
            throw new InvalidOperationException("Key not loaded. Call LoadAsync() at startup.");
        return new
        {
            keys = new[]
            {
                new
                {
                    kty = "RSA",
                    use = "sig",
                    alg = "RS256",
                    kid = _keyId,
                    n = Base64UrlEncoder.Encode(_jwk.N!),
                    e = Base64UrlEncoder.Encode(_jwk.E!)
                }
            }
        };
    }
}
