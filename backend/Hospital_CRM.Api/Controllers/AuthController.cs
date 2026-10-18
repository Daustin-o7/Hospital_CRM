using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
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

    public AuthController(HospitalCrmDbContext db, IConfiguration config, IPersistentKeyService keyService, IWebHostEnvironment env)
    {
        _db = db;
        _config = config;
        _keyService = keyService;
        _env = env;
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

        if (!int.TryParse(_config["Jwt:AccessTokenExpiryMinutes"], out var tokenExpiry))
            tokenExpiry = 15;

        if (!int.TryParse(_config["Jwt:RefreshTokenExpiryDays"], out var refreshExpiryDays))
            refreshExpiryDays = 7;

        var accessToken = await GenerateJwtAsync(user.Id, user.Email, user.Role.ToString(), tokenExpiry, ct);
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
            user = new { id = user.Id, name = user.Name, email = user.Email, role = user.Role.ToString().ToLower() }
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest? request, CancellationToken ct)
    {
        var rawToken = !string.IsNullOrWhiteSpace(request?.RefreshToken)
            ? request.RefreshToken
            : Request.Cookies["refreshToken"];

        if (string.IsNullOrWhiteSpace(rawToken))
            return Unauthorized(new { error = "invalid_refresh_token" });

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

        storedToken.RevokedAt = DateTimeOffset.UtcNow;

        if (!int.TryParse(_config["Jwt:AccessTokenExpiryMinutes"], out var tokenExpiry))
            tokenExpiry = 15;

        if (!int.TryParse(_config["Jwt:RefreshTokenExpiryDays"], out var refreshExpiryDays))
            refreshExpiryDays = 7;

        var newAccessToken = await GenerateJwtAsync(user.Id, user.Email, user.Role.ToString(), tokenExpiry, ct);
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

    [HttpGet(".well-known/jwks.json")]
    public IActionResult GetJwks()
    {
        return Ok(_keyService.GetJwks());
    }

    private async Task<string> GenerateJwtAsync(Guid userId, string email, string role, int expiryMinutes, CancellationToken ct)
    {
        var issuer = _config["Jwt:Issuer"] ?? "Hospital_CRM";
        var audience = _config["Jwt:Audience"] ?? "Hospital_CRM";
        var keyId = _config["Jwt:KeyId"] ?? "hospital-crm-rsa-key-1";
        var expires = DateTimeOffset.UtcNow.AddMinutes(expiryMinutes).ToUnixTimeSeconds();
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        var header = JsonSerializer.SerializeToElement(new { alg = "RS256", typ = "JWT", kid = keyId });
        var payload = JsonSerializer.SerializeToElement(new
        {
            sub = userId.ToString(),
            email,
            role,
            jti = Guid.NewGuid().ToString(),
            iss = issuer,
            aud = audience,
            exp = expires,
            iat = now
        });

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
