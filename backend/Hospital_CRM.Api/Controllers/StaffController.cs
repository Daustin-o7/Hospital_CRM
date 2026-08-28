using System.Security.Cryptography;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class StaffController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<StaffController> _logger;

    public StaffController(HospitalCrmDbContext db, ILogger<StaffController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpPost("invite")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Invite([FromBody] StaffInviteRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { error = "name_and_email_required" });

        if (!IsValidEmail(request.Email))
            return BadRequest(new { error = "invalid_email_format" });

        if (request.Role is not ("doctor" or "receptionist"))
            return BadRequest(new { error = "role_must_be_doctor_or_receptionist" });

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync([userId], ct);
        if (user?.ClinicId is null)
            return Forbid();

        var existingUser = await _db.Users.AnyAsync(u => u.Email == request.Email, ct);
        if (existingUser)
            return Conflict(new { error = "email_already_registered" });

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var invite = new StaffInvite
        {
            Id = Guid.NewGuid(),
            ClinicId = user.ClinicId.Value,
            Name = request.Name,
            Email = request.Email,
            Role = request.Role == "doctor" ? UserRole.Doctor : UserRole.Receptionist,
            TokenHash = BCrypt.Net.BCrypt.HashPassword(token),
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(72)
        };

        _db.StaffInvites.Add(invite);
        await _db.SaveChangesAsync(ct);

        _logger.LogWarning("Staff invite token for {Email}: {Token}", request.Email, token);

        return StatusCode(201, new { inviteId = invite.Id, expiresAt = invite.ExpiresAt });
    }

    [HttpPost("accept-invite")]
    public async Task<IActionResult> AcceptInvite([FromBody] AcceptInviteRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "token_password_and_name_required" });

        if (request.Password.Length < 8)
            return BadRequest(new { error = "password_must_be_at_least_8_characters" });

        var invites = await _db.StaffInvites
            .Where(i => i.AcceptedAt == null && i.ExpiresAt > DateTimeOffset.UtcNow)
            .ToListAsync(ct);

        var invite = invites.FirstOrDefault(i =>
            BCrypt.Net.BCrypt.Verify(request.Token, i.TokenHash));

        if (invite is null)
            return BadRequest(new { error = "invalid_or_expired_token" });

        var newUser = new User
        {
            Id = Guid.NewGuid(),
            ClinicId = invite.ClinicId,
            Name = request.Name,
            Email = invite.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = invite.Role,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        invite.AcceptedAt = DateTimeOffset.UtcNow;
        _db.Users.Add(newUser);
        await _db.SaveChangesAsync(ct);

        return Ok(new { userId = newUser.Id, email = newUser.Email, role = newUser.Role.ToString().ToLower() });
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email;
        }
        catch
        {
            return false;
        }
    }
}

public record StaffInviteRequest(string Name, string Email, string Role);
public record AcceptInviteRequest(string Token, string Password, string Name);
