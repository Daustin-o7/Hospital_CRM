using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class PasswordResetController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<PasswordResetController> _logger;

    public PasswordResetController(HospitalCrmDbContext db, ILogger<PasswordResetController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpPost("request-password-reset")]
    [AllowAnonymous]
    public async Task<IActionResult> RequestReset([FromBody] RequestResetRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { error = "email_required" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email, ct);

        // Always return 200 OK to prevent user enumeration attacks
        if (user is null)
            return Ok(new { message = "If the email exists, a reset token has been issued." });

        var rawToken = Guid.NewGuid().ToString("N");
        var tokenHash = BCrypt.Net.BCrypt.HashPassword(rawToken);

        var resetToken = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1)
        };

        _db.PasswordResetTokens.Add(resetToken);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Password reset requested for user {UserId}", user.Id);

        return Ok(new { message = "If the email exists, a reset token has been issued.", resetToken = rawToken });
    }

    [HttpPost("confirm-password-reset")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmReset([FromBody] ConfirmResetRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ResetToken) || string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest(new { error = "token_and_password_required" });

        var validTokens = await _db.PasswordResetTokens
            .Where(t => t.UsedAt == null && t.ExpiresAt > DateTimeOffset.UtcNow)
            .OrderByDescending(t => t.ExpiresAt)
            .Take(50)
            .ToListAsync(ct);

        var tokenRecord = validTokens.FirstOrDefault(t => BCrypt.Net.BCrypt.Verify(request.ResetToken, t.TokenHash));
        if (tokenRecord is null)
            return BadRequest(new { error = "invalid_or_expired_token" });

        var user = await _db.Users.FindAsync([tokenRecord.UserId], ct);
        if (user is null)
            return BadRequest(new { error = "user_not_found" });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTimeOffset.UtcNow;
        tokenRecord.UsedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "password_reset_successful" });
    }
}

public record RequestResetRequest(string Email);
public record ConfirmResetRequest(string ResetToken, string NewPassword);
