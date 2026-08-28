using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/auth/password-reset")]
public class PasswordResetController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<PasswordResetController> _logger;
    private const int TokenExpiryMinutes = 30;

    public PasswordResetController(HospitalCrmDbContext db, ILogger<PasswordResetController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpPost("request")]
    public async Task<IActionResult> RequestReset([FromBody] PasswordResetRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email, ct);

        // Always return 200 to prevent email enumeration
        if (user is null)
            return Ok(new { message = "If the email exists, a reset link has been sent." });

        var token = Guid.NewGuid().ToString("N");

        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = BCrypt.Net.BCrypt.HashPassword(token),
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(TokenExpiryMinutes)
        });
        await _db.SaveChangesAsync(ct);

        // Production: send email. For now, log it.
        _logger.LogWarning("Password reset token for {Email}: {Token}", request.Email, token);

        return Ok(new { message = "If the email exists, a reset link has been sent." });
    }

    [HttpPost("confirm")]
    public async Task<IActionResult> ConfirmReset([FromBody] PasswordResetConfirmRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest(new { error = "token_and_newPassword_required" });

        var resetTokens = await _db.PasswordResetTokens
            .Where(t => t.UsedAt == null && t.ExpiresAt > DateTimeOffset.UtcNow)
            .ToListAsync(ct);

        var storedToken = resetTokens.FirstOrDefault(t =>
            BCrypt.Net.BCrypt.Verify(request.Token, t.TokenHash));

        if (storedToken is null)
            return BadRequest(new { error = "invalid_or_expired_token" });

        var user = await _db.Users.FindAsync([storedToken.UserId], ct);
        if (user is null)
            return BadRequest(new { error = "invalid_or_expired_token" });

        // Update password
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTimeOffset.UtcNow;

        // Mark token as used
        storedToken.UsedAt = DateTimeOffset.UtcNow;

        // Revoke all refresh tokens for this user
        var activeTokens = await _db.RefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var token in activeTokens)
            token.RevokedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Password has been reset successfully." });
    }
}

public record PasswordResetRequest(string Email);
public record PasswordResetConfirmRequest(string Token, string NewPassword);
