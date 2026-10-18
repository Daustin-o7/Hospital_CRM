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

        if (!Enum.TryParse<UserRole>(request.Role, true, out var role) || role == UserRole.PlatformAdmin)
            return BadRequest(new { error = "invalid_role" });

        var existingUser = await _db.Users.AnyAsync(u => u.Email == request.Email, ct);
        if (existingUser)
            return Conflict(new { error = "email_already_registered" });

        var rawToken = Guid.NewGuid().ToString("N");
        var tokenHash = rawToken.HashPassword();

        var invite = new StaffInvite
        {
            Id = Guid.NewGuid(),
            ClinicId = adminUser.ClinicId.Value,
            Name = request.Name,
            Email = request.Email,
            Role = role,
            TokenHash = tokenHash,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };

        if (request.Role.Equals("Nurse", StringComparison.OrdinalIgnoreCase))
        {
            invite.LicenseNumber = request.LicenseNumber;
            invite.LicenseAuthority = request.LicenseAuthority;
            invite.LicenseIssueDate = request.LicenseIssueDate;
            invite.LicenseExpiryDate = request.LicenseExpiryDate;
            invite.NursingQualification = request.NursingQualification;
            invite.Institution = request.Institution;
            invite.GraduationYear = request.GraduationYear ?? 0;
            invite.Specialization = request.Specialization;
            invite.YearsExperience = request.YearsExperience ?? 0;
            invite.Skills = request.Skills;
            invite.Languages = request.Languages;
            invite.EmergencyContactName = request.EmergencyContactName;
            invite.EmergencyContactPhone = request.EmergencyContactPhone;
            invite.EmergencyContactRelation = request.EmergencyContactRelation;
            invite.ShiftPreferencesJson = request.ShiftPreferencesJson;
            invite.WorkRestrictionsJson = request.WorkRestrictionsJson;
            invite.DepartmentId = request.DepartmentId;
            invite.WardId = request.WardId;
            invite.Designation = request.Designation;
            invite.EmploymentType = request.EmploymentType ?? EmploymentType.FullTime;
            invite.EmploymentStatus = request.EmploymentStatus ?? EmploymentStatus.Active;
        }

        _db.StaffInvites.Add(invite);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Invite link generated for {Email}: token={Token}", request.Email, rawToken);

        return Ok(new
        {
            inviteId = invite.Id,
            inviteToken = rawToken,
            expiresAt = invite.ExpiresAt
        });
    }

    [HttpPost("accept-invite")]
    [AllowAnonymous]
    public async Task<IActionResult> AcceptInvite([FromBody] AcceptInviteRequest request, CancellationToken ct)
    {
        var validInvites = await _db.StaffInvites
            .Where(i => i.ExpiresAt > DateTimeOffset.UtcNow && i.AcceptedAt == null)
            .ToListAsync(ct);

        var invite = validInvites.FirstOrDefault(i => request.InviteToken.VerifyPassword(i.TokenHash));

        if (invite is null)
            return Unauthorized(new { error = "invalid_or_expired_invite" });

        var existingUser = await _db.Users.AnyAsync(u => u.Email == invite.Email, ct);
        if (existingUser)
            return Conflict(new { error = "email_already_registered" });

        var user = new User
        {
            Id = Guid.NewGuid(),
            ClinicId = invite.ClinicId,
            Name = invite.Name,
            Email = invite.Email,
            PasswordHash = request.Password.HashPassword(),
            Role = invite.Role,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.Users.Add(user);

        // Create NurseProfile if role is Nurse
        if (invite.Role == UserRole.Nurse)
        {
            var nurseProfile = new NurseProfile
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TenantId = Guid.Empty,
                DepartmentId = invite.DepartmentId,
                WardId = invite.WardId,
                Designation = invite.Designation ?? "Staff Nurse",
                EmploymentType = invite.EmploymentType,
                JoiningDate = DateOnly.FromDateTime(DateTime.UtcNow),
                Status = invite.EmploymentStatus,
                LicenseNumber = invite.LicenseNumber ?? "N/A",
                LicenseAuthority = invite.LicenseAuthority ?? "Nursing Council",
                LicenseIssueDate = invite.LicenseIssueDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                LicenseExpiryDate = invite.LicenseExpiryDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddYears(5)),
                NursingQualification = invite.NursingQualification ?? "General Nursing",
                Institution = invite.Institution ?? "Medical College",
                GraduationYear = invite.GraduationYear,
                Specialization = invite.Specialization ?? "General",
                YearsExperience = invite.YearsExperience,
                Skills = invite.Skills ?? string.Empty,
                Languages = invite.Languages ?? string.Empty,
                EmergencyContactName = invite.EmergencyContactName ?? string.Empty,
                EmergencyContactPhone = invite.EmergencyContactPhone ?? string.Empty,
                EmergencyContactRelation = invite.EmergencyContactRelation ?? string.Empty,
                ShiftPreferencesJson = invite.ShiftPreferencesJson ?? string.Empty,
                WorkRestrictionsJson = invite.WorkRestrictionsJson ?? string.Empty,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            _db.NurseProfiles.Add(nurseProfile);
            invite.NurseProfileId = nurseProfile.Id;
        }

        invite.AcceptedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "invite_accepted", userId = user.Id });
    }

    [HttpGet("invites")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> ListInvites(CancellationToken ct)
    {
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        var invites = await _db.StaffInvites
            .Where(i => i.ClinicId == adminUser.ClinicId.Value && i.AcceptedAt == null && i.ExpiresAt > DateTimeOffset.UtcNow)
            .OrderByDescending(i => i.ExpiresAt)
            .Select(i => new
            {
                id = i.Id,
                name = i.Name,
                email = i.Email,
                role = i.Role.ToString().ToLower(),
                expiresAt = i.ExpiresAt
            })
            .ToListAsync(ct);

        return Ok(invites);
    }

    [HttpDelete("invites/{id:guid}")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> CancelInvite(Guid id, CancellationToken ct)
    {
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        var invite = await _db.StaffInvites
            .FirstOrDefaultAsync(i => i.Id == id && i.ClinicId == adminUser.ClinicId.Value && i.AcceptedAt == null, ct);

        if (invite is null)
            return NotFound(new { error = "invite_not_found" });

        _db.StaffInvites.Remove(invite);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "invite_cancelled" });
    }

    [HttpGet]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> ListStaff(CancellationToken ct)
    {
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        var staff = await _db.Users
            .Where(u => u.ClinicId == adminUser.ClinicId.Value && u.Role != UserRole.PlatformAdmin)
            .OrderBy(u => u.Name)
            .Select(u => new
            {
                id = u.Id,
                name = u.Name,
                email = u.Email,
                role = u.Role.ToString().ToLower(),
                status = "Active",
                joinedAt = u.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(staff);
    }
}

public record StaffInviteRequest(
    [Required(ErrorMessage = "Staff Name is required"), StringLength(100, MinimumLength = 2, ErrorMessage = "Staff Name must be between 2 and 100 characters")]
    string Name,

    [Required(ErrorMessage = "Email is required"), EmailAddress(ErrorMessage = "Valid email address required"), StringLength(254)]
    string Email,

    [Required(ErrorMessage = "Role is required")]
    string Role,

    // Nurse-specific optional fields
    string? LicenseNumber = null,
    string? LicenseAuthority = null,
    DateOnly? LicenseIssueDate = null,
    DateOnly? LicenseExpiryDate = null,
    string? NursingQualification = null,
    string? Institution = null,
    int? GraduationYear = null,
    string? Specialization = null,
    int? YearsExperience = null,
    string? Skills = null,
    string? Languages = null,
    string? EmergencyContactName = null,
    string? EmergencyContactPhone = null,
    string? EmergencyContactRelation = null,
    string? ShiftPreferencesJson = null,
    string? WorkRestrictionsJson = null,
    Guid? DepartmentId = null,
    Guid? WardId = null,
    string? Designation = null,
    EmploymentType? EmploymentType = null,
    EmploymentStatus? EmploymentStatus = null);

public record AcceptInviteRequest(
    [Required(ErrorMessage = "InviteToken is required")]
    string InviteToken,

    [Required(ErrorMessage = "Password is required"), MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    string Password);
