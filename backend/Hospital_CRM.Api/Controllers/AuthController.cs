using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(HospitalCrmDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email, ct);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { error = "invalid_credentials" });

        if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTimeOffset.UtcNow)
            return StatusCode(423, new { error = "account_locked", retryAfterSeconds = (int)(user.LockedUntil.Value - DateTimeOffset.UtcNow).TotalSeconds });

        var tokenExpiry = int.Parse(_config["Jwt:AccessTokenExpiryMinutes"] ?? "15");
        var refreshExpiryDays = int.Parse(_config["Jwt:RefreshTokenExpiryDays"] ?? "7");

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

        var allTokens = await _db.RefreshTokens
            .Where(t => t.ExpiresAt > DateTimeOffset.UtcNow)
            .ToListAsync(ct);

        var storedToken = allTokens.FirstOrDefault(t =>
            t.RevokedAt == null && BCrypt.Net.BCrypt.Verify(request.RefreshToken, t.TokenHash));

        if (storedToken is null)
            return Unauthorized(new { error = "invalid_refresh_token" });

        var user = await _db.Users.FindAsync([storedToken.UserId], ct);
        if (user is null)
            return Unauthorized(new { error = "invalid_refresh_token" });

        // Revoke old token
        storedToken.RevokedAt = DateTimeOffset.UtcNow;

        // Issue new pair
        var tokenExpiry = int.Parse(_config["Jwt:AccessTokenExpiryMinutes"] ?? "15");
        var refreshExpiryDays = int.Parse(_config["Jwt:RefreshTokenExpiryDays"] ?? "7");

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

    private string GenerateJwt(Guid userId, string email, string role, int expiryMinutes)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim("role", role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Email, string Password);
public record RefreshRequest(string RefreshToken);
