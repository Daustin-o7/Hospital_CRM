using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Services;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IConfiguration _config;
    private readonly IPersistentKeyService _keyService;
    private readonly IWebHostEnvironment _env;
    private readonly ISecretProtector _secretProtector;

    public AuthController(
        HospitalCrmDbContext db,
        IConfiguration config,
        IPersistentKeyService keyService,
        IWebHostEnvironment env,
        ISecretProtector secretProtector)
    {
        _db = db;
        _config = config;
        _keyService = keyService;
        _env = env;
        _secretProtector = secretProtector;
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "invalid_credentials" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email, ct);

        if (user == null)
            return Unauthorized(new { error = "invalid_credentials" });

        if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTimeOffset.UtcNow)
            return Unauthorized(new { error = "invalid_credentials" });

        if (!request.Password.VerifyPassword(user.PasswordHash))
        {
            // Brute-force lockout: count failures and lock the account past the threshold.
            var maxAttempts = _config.GetValue<int>("Auth:MaxFailedAttempts", 5);
            var lockMinutes = _config.GetValue<int>("Auth:LockoutMinutes", 15);

            user.FailedLoginCount++;
            if (user.FailedLoginCount >= maxAttempts)
                user.LockedUntil = DateTimeOffset.UtcNow.AddMinutes(lockMinutes);
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);

            return Unauthorized(new { error = "invalid_credentials" });
        }

        // A4.3: Enforce subscription lifecycle on login
        if (user.Role != UserRole.PlatformAdmin && user.TenantId.HasValue && user.TenantId.Value != Guid.Empty)
        {
            var tenant = await _db.Tenants.AsNoTracking()
                .Where(t => t.Id == user.TenantId.Value)
                .Select(t => new { t.SubscriptionStatus, t.SubscriptionEndsAt })
                .FirstOrDefaultAsync(ct);

            if (tenant is null)
                return StatusCode(StatusCodes.Status403Forbidden, new { error = "tenant_not_found" });

            var access = SubscriptionPolicy.EffectiveAccess(tenant.SubscriptionStatus, tenant.SubscriptionEndsAt, DateTimeOffset.UtcNow);
            if (access == EffectiveAccessLevel.Blocked)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    error = "tenant_suspended",
                    message = "Tenant subscription is suspended or expired."
                });
            }
        }

        // A1: with TOTP enrolled, the password alone yields a short-lived challenge only.
        if (user.MfaEnabled)
            return Ok(new { mfaRequired = true, challengeToken = CreateMfaChallenge(user) });

        return await IssueSessionAsync(user, ct);
    }

    /// <summary>Issues access and refresh tokens, including the A1 setup flags the UI reads.</summary>
    private async Task<IActionResult> IssueSessionAsync(User user, CancellationToken ct)
    {
        if (!int.TryParse(_config["Jwt:AccessTokenExpiryMinutes"], out var tokenExpiry))
            tokenExpiry = 15;

        if (!int.TryParse(_config["Jwt:RefreshTokenExpiryDays"], out var refreshExpiryDays))
            refreshExpiryDays = 7;

        var accessToken = await GenerateJwtAsync(user.Id, user.Email, user.Role.ToString(), user.TenantId, tokenExpiry, ct, SessionClaims(user));
        var refreshToken = Guid.NewGuid().ToString("N");

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = refreshToken.HashPassword(),
            IssuedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(refreshExpiryDays),
            LastUsedAt = DateTimeOffset.UtcNow
        });

        user.FailedLoginCount = 0;
        user.LockedUntil = null;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = !_env.IsDevelopment() || Request.IsHttps,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(refreshExpiryDays)
        });

        return Ok(new
        {
            accessToken,
            refreshToken,
            expiresIn = tokenExpiry * 60,
            mustChangePassword = user.MustChangePassword,
            mfaSetupRequired = user.Role == UserRole.PlatformAdmin && !user.MfaEnabled,
            user = new { id = user.Id, name = user.Name, email = user.Email, role = user.Role.ToString().ToLower() }
        });
    }

    private static Dictionary<string, object?> SessionClaims(User user)
    {
        var claims = new Dictionary<string, object?>();
        if (user.MustChangePassword)
            claims["must_change_password"] = "true";
        if (user.MfaEnabled)
            claims["mfa_enabled"] = "true";
        return claims;
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest? request, CancellationToken ct)
    {
        var rawToken = !string.IsNullOrWhiteSpace(request?.RefreshToken)
            ? request.RefreshToken
            : Request.Cookies["refreshToken"];

        // No credential at all (fresh visitor, or cookie cleared): nothing to refresh.
        // 204 keeps the boot probe out of the console; a presented-but-invalid token still gets 401.
        if (string.IsNullOrWhiteSpace(rawToken))
            return NoContent();

        var candidateTokens = await _db.RefreshTokens
            .Where(t => t.ExpiresAt > DateTimeOffset.UtcNow && t.RevokedAt == null)
            .OrderByDescending(t => t.IssuedAt)
            .Take(100)
            .ToListAsync(ct);

        var storedToken = candidateTokens.FirstOrDefault(t => rawToken.VerifyPassword(t.TokenHash));

        if (storedToken is null)
            return Unauthorized(new { error = "invalid_refresh_token" });

        var user = await _db.Users.FindAsync([storedToken.UserId], ct);
        if (user is null)
            return Unauthorized(new { error = "invalid_refresh_token" });

        // A4.3: Enforce subscription lifecycle on refresh
        if (user.Role != UserRole.PlatformAdmin && user.TenantId.HasValue && user.TenantId.Value != Guid.Empty)
        {
            var tenant = await _db.Tenants.AsNoTracking()
                .Where(t => t.Id == user.TenantId.Value)
                .Select(t => new { t.SubscriptionStatus, t.SubscriptionEndsAt })
                .FirstOrDefaultAsync(ct);

            if (tenant is null)
                return StatusCode(StatusCodes.Status403Forbidden, new { error = "tenant_not_found" });

            var access = SubscriptionPolicy.EffectiveAccess(tenant.SubscriptionStatus, tenant.SubscriptionEndsAt, DateTimeOffset.UtcNow);
            if (access == EffectiveAccessLevel.Blocked)
            {
                storedToken.RevokedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(ct);
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    error = "tenant_suspended",
                    message = "Tenant subscription is suspended or expired."
                });
            }
        }

        storedToken.RevokedAt = DateTimeOffset.UtcNow;

        if (!int.TryParse(_config["Jwt:AccessTokenExpiryMinutes"], out var tokenExpiry))
            tokenExpiry = 15;

        if (!int.TryParse(_config["Jwt:RefreshTokenExpiryDays"], out var refreshExpiryDays))
            refreshExpiryDays = 7;

        var newAccessToken = await GenerateJwtAsync(user.Id, user.Email, user.Role.ToString(), user.TenantId, tokenExpiry, ct, SessionClaims(user));
        var newRefreshToken = Guid.NewGuid().ToString("N");

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = newRefreshToken.HashPassword(),
            IssuedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(refreshExpiryDays),
            LastUsedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        Response.Cookies.Append("refreshToken", newRefreshToken, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = !_env.IsDevelopment() || Request.IsHttps,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(refreshExpiryDays)
        });

        return Ok(new
        {
            accessToken = newAccessToken,
            refreshToken = newRefreshToken,
            expiresIn = tokenExpiry * 60,
            user = new { id = user.Id, name = user.Name, email = user.Email, role = user.Role.ToString().ToLower() }
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest? request, CancellationToken ct)
    {
        var rawToken = !string.IsNullOrWhiteSpace(request?.RefreshToken)
            ? request.RefreshToken
            : Request.Cookies["refreshToken"];

        if (!string.IsNullOrWhiteSpace(rawToken))
        {
            var candidateTokens = await _db.RefreshTokens
                .Where(t => t.ExpiresAt > DateTimeOffset.UtcNow && t.RevokedAt == null)
                .OrderByDescending(t => t.IssuedAt)
                .Take(100)
                .ToListAsync(ct);

            var storedToken = candidateTokens.FirstOrDefault(t => rawToken.VerifyPassword(t.TokenHash));
            if (storedToken != null)
            {
                storedToken.RevokedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(ct);
            }
        }

        Response.Cookies.Delete("refreshToken", new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = !_env.IsDevelopment() || Request.IsHttps,
            Path = "/"
        });

        return Ok(new { message = "logged_out" });
    }

    // ── A1: bootstrap hardening ──────────────────────────────────────────────
    // The production bootstrap command sets MustChangePassword; the token carries the flag
    // and AccountSetupEnforcementMiddleware allows only the calls below until it is cleared.

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
            return Unauthorized(new { error = "not_authenticated" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user is null)
            return Unauthorized(new { error = "not_authenticated" });

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
            !request.CurrentPassword.VerifyPassword(user.PasswordHash))
        {
            return BadRequest(new { error = "invalid_current_password" });
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            return BadRequest(new { error = "password_too_short", message = "Use at least 8 characters." });

        if (request.NewPassword == request.CurrentPassword)
            return BadRequest(new { error = "password_unchanged" });

        user.PasswordHash = request.NewPassword.HashPassword();
        user.MustChangePassword = false;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        // Sessions that predate the new password die with it.
        var liveTokens = await _db.RefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var token in liveTokens)
            token.RevokedAt = DateTimeOffset.UtcNow;

        return await IssueSessionAsync(user, ct);
    }

    [HttpPost("mfa/setup")]
    [Authorize]
    public async Task<IActionResult> StartMfaSetup(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
            return Unauthorized(new { error = "not_authenticated" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user is null)
            return Unauthorized(new { error = "not_authenticated" });

        if (user.MfaEnabled)
            return BadRequest(new { error = "mfa_already_enabled" });

        var secret = TotpService.GenerateSecret();
        user.MfaSecret = _secretProtector.Protect(secret);
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            secret,
            otpauthUri = TotpService.BuildOtpAuthUri("SAMSTACK Care", user.Email, secret)
        });
    }

    [HttpPost("mfa/enable")]
    [Authorize]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> EnableMfa([FromBody] MfaCodeRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
            return Unauthorized(new { error = "not_authenticated" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user is null)
            return Unauthorized(new { error = "not_authenticated" });

        if (user.MfaEnabled)
            return BadRequest(new { error = "mfa_already_enabled" });

        var secret = _secretProtector.Unprotect(user.MfaSecret);
        if (secret is null)
            return BadRequest(new { error = "mfa_not_initialized" });

        if (!TotpService.Verify(secret, request.Code, DateTimeOffset.UtcNow))
            return BadRequest(new { error = "invalid_code" });

        user.MfaEnabled = true;
        // A fresh session so the mfa_enabled claim (and the setup gate) are current.
        return await IssueSessionAsync(user, ct);
    }

    [HttpPost("mfa/disable")]
    [Authorize]
    public async Task<IActionResult> DisableMfa([FromBody] MfaDisableRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (userId is null)
            return Unauthorized(new { error = "not_authenticated" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user is null)
            return Unauthorized(new { error = "not_authenticated" });

        // Platform admins keep MFA; recovery is the operator CLI (--reset-mfa).
        if (user.Role == UserRole.PlatformAdmin)
            return BadRequest(new { error = "mfa_required_for_platform_admin" });

        if (!user.MfaEnabled)
            return Ok(new { mfaEnabled = false });

        if (string.IsNullOrWhiteSpace(request.Password) || !request.Password.VerifyPassword(user.PasswordHash))
            return BadRequest(new { error = "invalid_password" });

        user.MfaEnabled = false;
        user.MfaSecret = null;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { mfaEnabled = false });
    }

    /// <summary>Second login step for a user with TOTP enrolled.</summary>
    [HttpPost("mfa/verify")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> VerifyMfa([FromBody] MfaVerifyRequest request, CancellationToken ct)
    {
        var userId = ReadMfaChallenge(request.ChallengeToken);
        if (userId is null)
            return Unauthorized(new { error = "invalid_challenge" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user is null || !user.MfaEnabled)
            return Unauthorized(new { error = "invalid_challenge" });

        var secret = _secretProtector.Unprotect(user.MfaSecret);
        if (secret is null || !TotpService.Verify(secret, request.Code, DateTimeOffset.UtcNow))
            return Unauthorized(new { error = "invalid_code" });

        return await IssueSessionAsync(user, ct);
    }

    private string CreateMfaChallenge(User user) =>
        _secretProtector.Protect($"mfa|{user.Id}|{DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds()}");

    private Guid? ReadMfaChallenge(string? challengeToken)
    {
        if (string.IsNullOrWhiteSpace(challengeToken))
            return null;

        var raw = _secretProtector.Unprotect(challengeToken);
        if (raw is null)
            return null;

        var parts = raw.Split('|');
        if (parts.Length != 3 || parts[0] != "mfa")
            return null;

        if (!long.TryParse(parts[2], out var expiresAt) ||
            expiresAt < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
        {
            return null;
        }

        return Guid.TryParse(parts[1], out var userId) ? userId : null;
    }

    [HttpGet(".well-known/jwks.json")]
    public IActionResult GetJwks()
    {
        return Ok(_keyService.GetJwks());
    }

    private async Task<string> GenerateJwtAsync(Guid userId, string email, string role, Guid? tenantId, int expiryMinutes,
        CancellationToken ct, IReadOnlyDictionary<string, object?>? extraClaims = null)
    {
        var issuer = _config["Jwt:Issuer"] ?? "Hospital_CRM";
        var audience = _config["Jwt:Audience"] ?? "Hospital_CRM";
        var keyId = _config["Jwt:KeyId"] ?? "hospital-crm-rsa-key-1";
        var expires = DateTimeOffset.UtcNow.AddMinutes(expiryMinutes).ToUnixTimeSeconds();
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        var header = JsonSerializer.SerializeToElement(new { alg = "RS256", typ = "JWT", kid = keyId });
        var payloadDict = new Dictionary<string, object?>
        {
            ["sub"] = userId.ToString(),
            ["email"] = email,
            ["role"] = role,
            ["jti"] = Guid.NewGuid().ToString(),
            ["iss"] = issuer,
            ["aud"] = audience,
            ["exp"] = expires,
            ["iat"] = now
        };

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            payloadDict["tenant_id"] = tenantId.Value.ToString();
        }

        if (extraClaims is not null)
        {
            foreach (var (name, value) in extraClaims)
                payloadDict[name] = value;
        }

        var payload = JsonSerializer.SerializeToElement(payloadDict);

        var headerB64 = Base64UrlEncode(header.GetRawText());
        var payloadB64 = Base64UrlEncode(payload.GetRawText());
        var signingInput = $"{headerB64}.{payloadB64}";
        var signature = await _keyService.SignAsync(Encoding.UTF8.GetBytes(signingInput), ct);
        var signatureB64 = Base64UrlEncode(signature);

        return $"{signingInput}.{signatureB64}";
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string Base64UrlEncode(string text) =>
        Base64UrlEncode(Encoding.UTF8.GetBytes(text));
}

public record LoginRequest(
    [Required(ErrorMessage = "Email is required"), EmailAddress(ErrorMessage = "Please enter a valid email address")]
    string Email,

    [Required(ErrorMessage = "Password is required")]
    string Password);

public record RefreshRequest(
    string? RefreshToken = null);

public record ChangePasswordRequest(
    string? CurrentPassword,
    string? NewPassword);

public record MfaCodeRequest(string? Code);

public record MfaVerifyRequest(string? ChallengeToken, string? Code);

public record MfaDisableRequest(string? Password);
