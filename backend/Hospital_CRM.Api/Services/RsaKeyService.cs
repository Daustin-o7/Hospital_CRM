using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Hospital_CRM.Api.Services;

public interface IRsaKeyService
{
    RsaSecurityKey GetPrivateKey();
    RsaSecurityKey GetPublicKey();
    object GetJwks();
}

public class RsaKeyService : IRsaKeyService
{
    // Shared key material — only one set of keys per process so that
    // tokens signed by AuthController validate against the same public key.
    private static RSA? _sharedRsa;
    private static RsaSecurityKey? _sharedPrivateKey;
    private static RsaSecurityKey? _sharedPublicKey;
    private static string? _sharedKeyId;
    private static readonly object _lock = new();

    private readonly RSA _rsa;
    private readonly RsaSecurityKey _privateKey;
    private readonly RsaSecurityKey _publicKey;
    private readonly string _keyId;

    public RsaKeyService(IConfiguration config)
    {
        lock (_lock)
        {
            if (_sharedRsa is null)
            {
                _sharedRsa = RSA.Create(2048);
                _sharedKeyId = config["Jwt:KeyId"] ?? "hospital-crm-rsa-key-1";
                _sharedPrivateKey = new RsaSecurityKey(_sharedRsa) { KeyId = _sharedKeyId };
                _sharedPublicKey = new RsaSecurityKey(_sharedRsa.ExportParameters(false)) { KeyId = _sharedKeyId };
            }
        }
        _rsa = _sharedRsa!;
        _privateKey = _sharedPrivateKey!;
        _publicKey = _sharedPublicKey!;
        _keyId = _sharedKeyId!;
    }

    public RsaSecurityKey GetPrivateKey() => _privateKey;
    public RsaSecurityKey GetPublicKey() => _publicKey;

    public object GetJwks()
    {
        var parameters = _rsa.ExportParameters(false);
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
                    n = Base64UrlEncoder.Encode(parameters.Modulus),
                    e = Base64UrlEncoder.Encode(parameters.Exponent)
                }
            }
        };
    }
}