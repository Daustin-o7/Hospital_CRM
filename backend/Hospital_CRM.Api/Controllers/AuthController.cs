using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IConfiguration _config;
    private readonly IRsaKeyService _rsaKeyService;

    public AuthController(HospitalCrmDbContext db, IConfiguration config, IRsaKeyService rsaKeyService)
    {
        _db = db;
        _config = config;
        _rsaKeyService = rsaKeyService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "invalid_credentials" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email, ct);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { error = "invalid_credentials" });

        if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTimeOffset.UtcNow)
            return StatusCode(423, new { error = "account_locked", retryAfterSeconds = (int)(user.LockedUntil.Value - DateTimeOffset.UtcNow).TotalSeconds });

        if (!int.TryParse(_config["Jwt:AccessTokenExpiryMinutes"], out var tokenExpiry))
            tokenExpiry = 15;

        if (!int.TryParse(_config["Jwt:RefreshTokenExpiryDays"], out var refreshExpiryDays))
            refreshExpiryDays = 7;

        var accessToken = GenerateJwt(user.Id, user.Email, user.Role.ToString(), tokenExpiry);
        var refreshToken = Guid.NewGuid().ToString("N");

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = BCrypt.Net.BCrypt.HashPassword(refreshToken),
            IssuedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(refreshExpiryDays),
            LastUsedAt = DateTimeOffset.UtcNow
        });

        user.FailedLoginCount = 0;
        user.LockedUntil = null;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            accessToken,
            refreshToken,
            expiresIn = tokenExpiry * 60,
            user = new { id = user.Id, name = user.Name, email = user.Email, role = user.Role.ToString().ToLower() }
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return Unauthorized(new { error = "invalid_refresh_token" });

        var candidateTokens = await _db.RefreshTokens
            .Where(t => t.ExpiresAt > DateTimeOffset.UtcNow && t.RevokedAt == null)
            .OrderByDescending(t => t.IssuedAt)
            .Take(100)
            .ToListAsync(ct);

        var storedToken = candidateTokens.FirstOrDefault(t => BCrypt.Net.BCrypt.Verify(request.RefreshToken, t.TokenHash));

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

        var newAccessToken = GenerateJwt(user.Id, user.Email, user.Role.ToString(), tokenExpiry);
        var newRefreshToken = Guid.NewGuid().ToString("N");

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = BCrypt.Net.BCrypt.HashPassword(newRefreshToken),
            IssuedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(refreshExpiryDays),
            LastUsedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            accessToken = newAccessToken,
            refreshToken = newRefreshToken,
            expiresIn = tokenExpiry * 60,
            user = new { id = user.Id, name = user.Name, email = user.Email, role = user.Role.ToString().ToLower() }
        });
    }

    [HttpGet(".well-known/jwks.json")]
    public IActionResult GetJwks()
    {
        return Ok(_rsaKeyService.GetJwks());
    }

    private string GenerateJwt(Guid userId, string email, string role, int expiryMinutes)
    {
        var signingCredentials = new SigningCredentials(_rsaKeyService.GetPrivateKey(), SecurityAlgorithms.RsaSha256);

        var issuer = _config["Jwt:Issuer"] ?? "Hospital_CRM";
        var audience = _config["Jwt:Audience"] ?? "Hospital_CRM";

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim("role", role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTimeOffset.UtcNow.AddMinutes(expiryMinutes).UtcDateTime,
            signingCredentials: signingCredentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Email, string Password);
public record RefreshRequest(string RefreshToken);
