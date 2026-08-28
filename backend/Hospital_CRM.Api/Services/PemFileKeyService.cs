using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Hospital_CRM.Api.Services;

/// <summary>
/// Local development / self-hosted implementation.
/// Reads a PKCS#8 PEM private key from disk. In Development, the file is
/// auto-generated on first run if missing; in non-Development environments
/// the service fails fast so a missing key is never silently replaced.
/// </summary>
public class PemFileKeyService : IPersistentKeyService
{
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<PemFileKeyService> _logger;

    private RSA? _rsa;
    private RsaSecurityKey? _privateKey;
    private RsaSecurityKey? _publicKey;
    private string? _keyId;

    public string KeySource => "PemFile";

    public PemFileKeyService(IConfiguration config, IWebHostEnvironment env, ILogger<PemFileKeyService> logger)
    {
        _config = config;
        _env = env;
        _logger = logger;
    }

    public Task LoadAsync(CancellationToken ct = default)
    {
        var path = _config["Jwt:PemFilePath"] ?? "./keys/jwt-private.pem";
        var absolute = Path.IsPathRooted(path)
            ? path
            : Path.Combine(_env.ContentRootPath, path);
        var dir = Path.GetDirectoryName(absolute);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

        if (File.Exists(absolute))
        {
            _logger.LogInformation("Loading RS256 private key from {Path}", absolute);
            var pem = File.ReadAllText(absolute);
            _rsa = RSA.Create();
            _rsa.ImportFromPem(pem);
        }
        else
        {
            if (!_env.IsDevelopment())
                throw new InvalidOperationException(
                    $"RS256 key file not found at '{absolute}'. In non-Development environments the key must be provisioned before startup.");

            _logger.LogWarning("No PEM key found at {Path}. Generating a development key (DEV ONLY).", absolute);
            _rsa = RSA.Create(2048);
            var pem = _rsa.ExportRSAPrivateKeyPem();
            File.WriteAllText(absolute, pem);
            // Gitignore-friendly best-effort: lock to current user on Windows.
            try
            {
                if (OperatingSystem.IsWindows())
                {
                    var info = new FileInfo(absolute);
                    // No portable ACL API cross-platform here — just ensure file exists.
                }
            }
            catch { /* best effort */ }
        }

        _keyId = _config["Jwt:KeyId"] ?? "hospital-crm-rsa-key-1";
        _privateKey = new RsaSecurityKey(_rsa) { KeyId = _keyId };
        _publicKey = new RsaSecurityKey(_rsa.ExportParameters(false)) { KeyId = _keyId };
        return Task.CompletedTask;
    }

    public RsaSecurityKey GetPrivateKey() => _privateKey ?? throw new InvalidOperationException("Key not loaded. Call LoadAsync() at startup.");
    public RsaSecurityKey GetPublicKey() => _publicKey ?? throw new InvalidOperationException("Key not loaded. Call LoadAsync() at startup.");

    public async Task<byte[]> SignAsync(byte[] data, CancellationToken ct = default)
    {
        if (_rsa == null) throw new InvalidOperationException("Key not loaded. Call LoadAsync() at startup.");
        return await Task.Run(() => _rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1), ct);
    }

    public object GetJwks()
    {
        if (_rsa is null || _keyId is null)
            throw new InvalidOperationException("Key not loaded. Call LoadAsync() at startup.");
        var p = _rsa.ExportParameters(false);
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
                    n = Base64UrlEncoder.Encode(p.Modulus),
                    e = Base64UrlEncoder.Encode(p.Exponent)
                }
            }
        };
    }
}