using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
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
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { error = "name_and_email_required" });

        var roleEnum = parseRole(request.Role);
        if (roleEnum is null)
            return BadRequest(new { error = "invalid_role" });

        var rawToken = Guid.NewGuid().ToString("N");
        var tokenHash = BCrypt.Net.BCrypt.HashPassword(rawToken);

        var invite = new StaffInvite
        {
            Id = Guid.NewGuid(),
            ClinicId = adminUser.ClinicId.Value,
            Name = request.Name,
            Email = request.Email.ToLowerInvariant(),
            Role = roleEnum.Value,
            TokenHash = tokenHash,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };

        _db.StaffInvites.Add(invite);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Staff invitation token created for {Email}", request.Email);

        return Ok(new { inviteId = invite.Id, inviteToken = rawToken, expiresAt = invite.ExpiresAt });
    }

    [HttpPost("accept-invite")]
    [AllowAnonymous]
    public async Task<IActionResult> AcceptInvite([FromBody] AcceptInviteRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.InviteToken) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "token_and_password_required" });

        var validInvites = await _db.StaffInvites
            .Where(i => i.AcceptedAt == null && i.ExpiresAt > DateTimeOffset.UtcNow)
            .OrderByDescending(i => i.ExpiresAt)
            .Take(50)
            .ToListAsync(ct);

        var invite = validInvites.FirstOrDefault(i => BCrypt.Net.BCrypt.Verify(request.InviteToken, i.TokenHash));
        if (invite is null)
            return BadRequest(new { error = "invalid_or_expired_token" });

        var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Email == invite.Email, ct);
        if (existingUser is not null)
            return BadRequest(new { error = "email_already_registered" });

        var user = new User
        {
            Id = Guid.NewGuid(),
            ClinicId = invite.ClinicId,
            Name = invite.Name,
            Email = invite.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = invite.Role,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        if (!user.IsClinicAssociationValid())
            return BadRequest(new { error = "invalid_clinic_association" });

        invite.AcceptedAt = DateTimeOffset.UtcNow;

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        return Ok(new { userId = user.Id, email = user.Email, role = user.Role.ToString().ToLower() });
    }

    [HttpGet]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        var staff = await _db.Users
            .Where(u => u.ClinicId == adminUser.ClinicId)
            .OrderBy(u => u.Name)
            .Select(u => new
            {
                id = u.Id,
                name = u.Name,
                email = u.Email,
                role = u.Role.ToString(),
                status = "Active",
                joinedAt = u.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(staff);
    }

    private static UserRole? parseRole(string role)
    {
        return role.ToLower() switch
        {
            "doctor" => UserRole.Doctor,
            "receptionist" => UserRole.Receptionist,
            "clinicadmin" or "admin" => UserRole.ClinicAdmin,
            _ => null
        };
    }
}

public record StaffInviteRequest(
    [Required(ErrorMessage = "Staff Name is required"), StringLength(100, MinimumLength = 2, ErrorMessage = "Staff Name must be between 2 and 100 characters")]
    string Name,

    [Required(ErrorMessage = "Email is required"), EmailAddress(ErrorMessage = "Valid email address required"), StringLength(254)]
    string Email,

    [Required(ErrorMessage = "Role is required")]
    string Role);

public record AcceptInviteRequest(
    [Required(ErrorMessage = "InviteToken is required")]
    string InviteToken,

    [Required(ErrorMessage = "Password is required"), MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    string Password);
