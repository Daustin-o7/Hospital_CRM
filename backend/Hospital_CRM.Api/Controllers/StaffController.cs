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

        // Set nurse-specific fields if provided and role is Nurse
        if (roleEnum == UserRole.Nurse)
        {
            invite.LicenseNumber = request.LicenseNumber ?? string.Empty;
            invite.LicenseAuthority = request.LicenseAuthority ?? string.Empty;
            invite.LicenseIssueDate = request.LicenseIssueDate;
            invite.LicenseExpiryDate = request.LicenseExpiryDate;
            invite.NursingQualification = request.NursingQualification ?? string.Empty;
            invite.Institution = request.Institution ?? string.Empty;
            invite.GraduationYear = request.GraduationYear ?? 0;
            invite.Specialization = request.Specialization ?? string.Empty;
            invite.YearsExperience = request.YearsExperience ?? 0;
            invite.Skills = request.Skills ?? string.Empty;
            invite.Languages = request.Languages ?? string.Empty;
            invite.EmergencyContactName = request.EmergencyContactName ?? string.Empty;
            invite.EmergencyContactPhone = request.EmergencyContactPhone ?? string.Empty;
            invite.EmergencyContactRelation = request.EmergencyContactRelation ?? string.Empty;
            invite.ShiftPreferencesJson = request.ShiftPreferencesJson ?? string.Empty;
            invite.WorkRestrictionsJson = request.WorkRestrictionsJson ?? string.Empty;
            invite.DepartmentId = request.DepartmentId;
            invite.WardId = request.WardId;
            invite.Designation = request.Designation ?? string.Empty;
            invite.EmploymentType = request.EmploymentType ?? EmploymentType.FullTime;
            invite.EmploymentStatus = request.EmploymentStatus ?? EmploymentStatus.Active;
        }

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

        // Create NurseProfile if role is Nurse
        if (invite.Role == UserRole.Nurse)
        {
            var nurseProfile = new NurseProfile
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TenantId = Guid.Empty,
                DepartmentId = invite.DepartmentId ?? Guid.Empty,
                WardId = invite.WardId,
                Designation = invite.Designation,
                EmploymentType = invite.EmploymentType,
                JoiningDate = DateOnly.FromDateTime(DateTime.UtcNow),
                Status = invite.EmploymentStatus,
                LicenseNumber = invite.LicenseNumber,
                LicenseAuthority = invite.LicenseAuthority,
                LicenseIssueDate = invite.LicenseIssueDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                LicenseExpiryDate = invite.LicenseExpiryDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddYears(5)),
                NursingQualification = invite.NursingQualification,
                Institution = invite.Institution,
                GraduationYear = invite.GraduationYear,
                Specialization = invite.Specialization,
                YearsExperience = invite.YearsExperience,
                Skills = invite.Skills,
                Languages = invite.Languages,
                EmergencyContactName = invite.EmergencyContactName,
                EmergencyContactPhone = invite.EmergencyContactPhone,
                EmergencyContactRelation = invite.EmergencyContactRelation,
                DocumentsJson = string.Empty,
                ShiftPreferencesJson = invite.ShiftPreferencesJson,
                WorkRestrictionsJson = invite.WorkRestrictionsJson,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
                CreatedBy = user.Id,
                UpdatedBy = user.Id
            };

            _db.NurseProfiles.Add(nurseProfile);
            await _db.SaveChangesAsync(ct);
        }

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

    // Nurse-specific endpoints
    [HttpGet("nurses")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> ListNurses(CancellationToken ct)
    {
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        var nurses = await _db.NurseProfiles
            .Where(n => n.TenantId == Guid.Empty && n.User.ClinicId == adminUser.ClinicId)
            .OrderBy(n => n.User.Name)
            .Select(n => new
            {
                id = n.Id,
                userId = n.UserId,
                name = n.User.Name,
                email = n.User.Email,
                designation = n.Designation,
                employmentType = n.EmploymentType.ToString(),
                status = n.Status.ToString(),
                licenseNumber = n.LicenseNumber,
                licenseExpiryDate = n.LicenseExpiryDate,
                specialization = n.Specialization,
                yearsExperience = n.YearsExperience,
                wardId = n.WardId,
                departmentId = n.DepartmentId,
                joiningDate = n.JoiningDate
            })
            .ToListAsync(ct);

        return Ok(nurses);
    }

    [HttpGet("nurses/{id}")]
    [AuthorizeRoles("ClinicAdmin", "Nurse")]
    public async Task<IActionResult> GetNurse(Guid id, CancellationToken ct)
    {
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        var nurse = await _db.NurseProfiles
            .Where(n => n.Id == id && n.TenantId == Guid.Empty && n.User.ClinicId == adminUser.ClinicId)
            .Select(n => new
            {
                id = n.Id,
                userId = n.UserId,
                name = n.User.Name,
                email = n.User.Email,
                designation = n.Designation,
                employmentType = n.EmploymentType.ToString(),
                status = n.Status.ToString(),
                licenseNumber = n.LicenseNumber,
                licenseAuthority = n.LicenseAuthority,
                licenseIssueDate = n.LicenseIssueDate,
                licenseExpiryDate = n.LicenseExpiryDate,
                nursingQualification = n.NursingQualification,
                institution = n.Institution,
                graduationYear = n.GraduationYear,
                specialization = n.Specialization,
                yearsExperience = n.YearsExperience,
                skills = n.Skills,
                languages = n.Languages,
                emergencyContactName = n.EmergencyContactName,
                emergencyContactPhone = n.EmergencyContactPhone,
                emergencyContactRelation = n.EmergencyContactRelation,
                documentsJson = n.DocumentsJson,
                shiftPreferencesJson = n.ShiftPreferencesJson,
                workRestrictionsJson = n.WorkRestrictionsJson,
                departmentId = n.DepartmentId,
                wardId = n.WardId,
                joiningDate = n.JoiningDate,
                supervisorId = n.SupervisorId
            })
            .FirstOrDefaultAsync(ct);

        if (nurse == null)
            return NotFound(new { error = "nurse_not_found" });

        // A Nurse may only read their own profile
        if (adminUser.Role == UserRole.Nurse && nurse.userId != adminId.Value)
            return Forbid();

        return Ok(nurse);
    }

    [HttpPut("nurses/{id}")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> UpdateNurse(Guid id, [FromBody] UpdateNurseRequest request, CancellationToken ct)
    {
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        var nurse = await _db.NurseProfiles
            .FirstOrDefaultAsync(n => n.Id == id && n.TenantId == Guid.Empty && n.User.ClinicId == adminUser.ClinicId, ct);

        if (nurse == null)
            return NotFound(new { error = "nurse_not_found" });

        // Update fields
        if (!string.IsNullOrWhiteSpace(request.Designation))
            nurse.Designation = request.Designation;
        if (request.EmploymentType.HasValue)
            nurse.EmploymentType = request.EmploymentType.Value;
        if (request.Status.HasValue)
            nurse.Status = request.Status.Value;
        if (!string.IsNullOrWhiteSpace(request.LicenseNumber))
            nurse.LicenseNumber = request.LicenseNumber;
        if (!string.IsNullOrWhiteSpace(request.LicenseAuthority))
            nurse.LicenseAuthority = request.LicenseAuthority;
        if (request.LicenseIssueDate.HasValue)
            nurse.LicenseIssueDate = request.LicenseIssueDate.Value;
        if (request.LicenseExpiryDate.HasValue)
            nurse.LicenseExpiryDate = request.LicenseExpiryDate.Value;
        if (!string.IsNullOrWhiteSpace(request.NursingQualification))
            nurse.NursingQualification = request.NursingQualification;
        if (!string.IsNullOrWhiteSpace(request.Institution))
            nurse.Institution = request.Institution;
        if (request.GraduationYear.HasValue)
            nurse.GraduationYear = request.GraduationYear.Value;
        if (!string.IsNullOrWhiteSpace(request.Specialization))
            nurse.Specialization = request.Specialization;
        if (request.YearsExperience.HasValue)
            nurse.YearsExperience = request.YearsExperience.Value;
        if (!string.IsNullOrWhiteSpace(request.Skills))
            nurse.Skills = request.Skills;
        if (!string.IsNullOrWhiteSpace(request.Languages))
            nurse.Languages = request.Languages;
        if (!string.IsNullOrWhiteSpace(request.EmergencyContactName))
            nurse.EmergencyContactName = request.EmergencyContactName;
        if (!string.IsNullOrWhiteSpace(request.EmergencyContactPhone))
            nurse.EmergencyContactPhone = request.EmergencyContactPhone;
        if (!string.IsNullOrWhiteSpace(request.EmergencyContactRelation))
            nurse.EmergencyContactRelation = request.EmergencyContactRelation;
        if (!string.IsNullOrWhiteSpace(request.DocumentsJson))
            nurse.DocumentsJson = request.DocumentsJson;
        if (!string.IsNullOrWhiteSpace(request.ShiftPreferencesJson))
            nurse.ShiftPreferencesJson = request.ShiftPreferencesJson;
        if (!string.IsNullOrWhiteSpace(request.WorkRestrictionsJson))
            nurse.WorkRestrictionsJson = request.WorkRestrictionsJson;
        if (request.DepartmentId.HasValue)
            nurse.DepartmentId = request.DepartmentId.Value;
        if (request.WardId.HasValue)
            nurse.WardId = request.WardId;
        if (request.SupervisorId.HasValue)
            nurse.SupervisorId = request.SupervisorId.Value;

        nurse.UpdatedAt = DateTimeOffset.UtcNow;
        nurse.UpdatedBy = adminId.Value;

        await _db.SaveChangesAsync(ct);
        await ShiftsController.LogAudit(_db, "NurseProfile", nurse.Id, nurse.Id, "updated", null,
            $"status:{nurse.Status}, designation:{nurse.Designation}", adminId.Value, ct);

        return Ok(new { message = "nurse_updated", nurseId = nurse.Id });
    }

    [HttpGet("nurses/{id}/availability")]
    [AuthorizeRoles("ClinicAdmin", "Nurse")]
    public async Task<IActionResult> GetNurseAvailability(Guid id, CancellationToken ct)
    {
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        var profile = await _db.NurseProfiles
            .FirstOrDefaultAsync(n => n.Id == id && n.TenantId == Guid.Empty && n.User.ClinicId == adminUser.ClinicId, ct);
        if (profile is null)
            return NotFound(new { error = "nurse_not_found" });
        if (adminUser.Role == UserRole.Nurse && profile.UserId != adminId.Value)
            return Forbid();

        var availabilities = await _db.NurseAvailabilities
            .Where(a => a.NurseProfileId == id && a.TenantId == Guid.Empty)
            .OrderBy(a => a.StartDate)
            .Select(a => new
            {
                id = a.Id,
                startDate = a.StartDate,
                endDate = a.EndDate,
                preferredShift = a.PreferredShift.ToString(),
                preferredWardId = a.PreferredWardId,
                nightShiftWilling = a.NightShiftWilling,
                weekendWilling = a.WeekendWilling,
                overtimeWilling = a.OvertimeWilling,
                notes = a.Notes,
                createdAt = a.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(availabilities);
    }

    [HttpPost("nurses/{id}/availability")]
    [AuthorizeRoles("ClinicAdmin", "Nurse")]
    public async Task<IActionResult> SetNurseAvailability(Guid id, [FromBody] SetAvailabilityRequest request, CancellationToken ct)
    {
        var adminId = User.GetUserId();
        if (!adminId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var adminUser = await _db.Users.FindAsync([adminId.Value], ct);
        if (adminUser?.ClinicId is null)
            return Forbid();

        var nurse = await _db.NurseProfiles
            .FirstOrDefaultAsync(n => n.Id == id && n.TenantId == Guid.Empty && n.User.ClinicId == adminUser.ClinicId, ct);

        if (nurse == null)
            return NotFound(new { error = "nurse_not_found" });

        if (adminUser.Role == UserRole.Nurse && nurse.UserId != adminId.Value)
            return Forbid();

        if (request.EndDate < request.StartDate)
            return BadRequest(new { error = "invalid_date_range" });

        var availability = new NurseAvailability
        {
            Id = Guid.NewGuid(),
            NurseProfileId = id,
            TenantId = Guid.Empty,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            PreferredShift = request.PreferredShift,
            PreferredWardId = request.PreferredWardId,
            NightShiftWilling = request.NightShiftWilling,
            WeekendWilling = request.WeekendWilling,
            OvertimeWilling = request.OvertimeWilling,
            Notes = request.Notes ?? string.Empty,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.NurseAvailabilities.Add(availability);
        await _db.SaveChangesAsync(ct);

        return Ok(new { availabilityId = availability.Id });
    }

    private static UserRole? parseRole(string role)
    {
        return role.ToLower() switch
        {
            "doctor" => UserRole.Doctor,
            "receptionist" => UserRole.Receptionist,
            "clinicadmin" or "admin" => UserRole.ClinicAdmin,
            "nurse" => UserRole.Nurse,
            "pharmacist" => UserRole.Pharmacist,
            _ => null
        };
    }

    // ── Own-profile helpers (nurse self-service) ─────────────────────────────

    [HttpGet("me/nurse-profile")]
    [AuthorizeRoles("Nurse")]
    public async Task<IActionResult> OwnNurseProfile(CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var profile = await _db.NurseProfiles
            .Where(p => p.UserId == callerId.Value)
            .Select(p => new { id = p.Id, name = p.User.Name, email = p.User.Email, designation = p.Designation })
            .FirstOrDefaultAsync(ct);

        if (profile is null)
            return NotFound(new { error = "nurse_not_found" });

        return Ok(profile);
    }

    // Minimal peer list for handover target picking — scoped to caller clinic, name/designation only, no license PII.
    [HttpGet("nurses/peers")]
    [AuthorizeRoles("Nurse")]
    public async Task<IActionResult> NursePeers(CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null)
            return Forbid();

        var peers = await _db.NurseProfiles
            .Where(p => p.User.ClinicId == caller.ClinicId && p.User.Id != callerId.Value && p.Status == EmploymentStatus.Active)
            .OrderBy(p => p.User.Name)
            .Select(p => new { id = p.Id, name = p.User.Name, designation = p.Designation })
            .ToListAsync(ct);

        return Ok(peers);
    }

    // ── Leave ────────────────────────────────────────────────────────────────

    [HttpPost("nurses/{id:guid}/leave")]
    [AuthorizeRoles("ClinicAdmin", "Nurse")]
    public async Task<IActionResult> RequestLeave(Guid id, [FromBody] CreateLeaveRequest request, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null)
            return Forbid();

        var profile = await _db.NurseProfiles
            .FirstOrDefaultAsync(p => p.Id == id && p.User.ClinicId == caller.ClinicId, ct);
        if (profile is null)
            return NotFound(new { error = "nurse_not_found" });

        if (caller.Role == UserRole.Nurse && profile.UserId != callerId.Value)
            return Forbid();

        if (request.EndDate < request.StartDate)
            return BadRequest(new { error = "invalid_date_range" });

        var leave = new LeaveRequest
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            NurseProfileId = id,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Type = request.Type,
            Status = LeaveStatus.Pending,
            Reason = request.Reason ?? string.Empty,
            RequestedBy = callerId.Value,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.LeaveRequests.Add(leave);
        await _db.SaveChangesAsync(ct);
        await ShiftsController.LogAudit(_db, "LeaveRequest", leave.Id, id, "created", null,
            $"{leave.Type} {leave.StartDate:yyyy-MM-dd}..{leave.EndDate:yyyy-MM-dd}", callerId.Value, ct);

        return Ok(new { leaveId = leave.Id, status = leave.Status.ToString() });
    }

    [HttpGet("nurses/{id:guid}/leave")]
    [AuthorizeRoles("ClinicAdmin", "Nurse")]
    public async Task<IActionResult> ListLeave(Guid id, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null)
            return Forbid();

        var profile = await _db.NurseProfiles
            .FirstOrDefaultAsync(p => p.Id == id && p.User.ClinicId == caller.ClinicId, ct);
        if (profile is null)
            return NotFound(new { error = "nurse_not_found" });
        if (caller.Role == UserRole.Nurse && profile.UserId != callerId.Value)
            return Forbid();

        var leaves = await _db.LeaveRequests
            .Where(l => l.NurseProfileId == id)
            .OrderByDescending(l => l.StartDate)
            .Select(l => new
            {
                id = l.Id,
                startDate = l.StartDate,
                endDate = l.EndDate,
                type = l.Type.ToString(),
                status = l.Status.ToString(),
                reason = l.Reason,
                reviewNote = l.ReviewNote
            })
            .ToListAsync(ct);

        return Ok(leaves);
    }

    [HttpGet("leave-requests")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> ListLeaveRequests([FromQuery] string? status, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null)
            return Forbid();

        var query = _db.LeaveRequests
            .Where(l => l.Nurse.User.ClinicId == caller.ClinicId);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<LeaveStatus>(status, true, out var parsed))
            query = query.Where(l => l.Status == parsed);

        var rows = await query
            .OrderByDescending(l => l.CreatedAt)
            .Take(200)
            .Select(l => new
            {
                id = l.Id,
                nurseProfileId = l.NurseProfileId,
                nurseName = l.Nurse.User.Name,
                startDate = l.StartDate,
                endDate = l.EndDate,
                type = l.Type.ToString(),
                status = l.Status.ToString(),
                reason = l.Reason,
                reviewNote = l.ReviewNote
            })
            .ToListAsync(ct);

        return Ok(rows);
    }

    // Approve/reject — approving flags roster shifts that collide with the leave window.
    [HttpPost("leave-requests/{id:guid}/review")]    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> ReviewLeave(Guid id, [FromBody] ReviewLeaveRequest request, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null)
            return Forbid();

        var leave = await _db.LeaveRequests
            .FirstOrDefaultAsync(l => l.Id == id && l.Nurse.User.ClinicId == caller.ClinicId, ct);
        if (leave is null)
            return NotFound(new { error = "leave_not_found" });
        if (leave.Status != LeaveStatus.Pending)
            return Conflict(new { error = "leave_already_reviewed" });

        var approved = string.Equals(request.Status, "Approved", StringComparison.OrdinalIgnoreCase);
        leave.Status = approved ? LeaveStatus.Approved : LeaveStatus.Rejected;
        leave.ReviewNote = request.Note ?? string.Empty;
        leave.ReviewedBy = callerId.Value;
        leave.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        await ShiftsController.LogAudit(_db, "LeaveRequest", leave.Id, leave.NurseProfileId, approved ? "approved" : "rejected",
            "Pending", leave.Status.ToString(), callerId.Value, ct);

        // Flag (not block) roster shifts that now clash with approved leave
        var conflicts = approved
            ? await _db.NurseShifts
                .Where(s => s.NurseProfileId == leave.NurseProfileId &&
                            s.Status == ShiftStatus.Assigned &&
                            s.Date >= leave.StartDate && s.Date <= leave.EndDate)
                .Select(s => new { id = s.Id, date = s.Date, shiftType = s.ShiftType.ToString() })
                .ToListAsync(ct)
            : [];

        return Ok(new { leaveId = leave.Id, status = leave.Status.ToString(), rosterConflicts = conflicts });
    }

    [HttpGet("leave-balances/{id:guid}")]
    [AuthorizeRoles("ClinicAdmin", "Nurse")]
    public async Task<IActionResult> LeaveBalance(Guid id, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null)
            return Forbid();

        var profile = await _db.NurseProfiles
            .FirstOrDefaultAsync(p => p.Id == id && p.User.ClinicId == caller.ClinicId, ct);
        if (profile is null)
            return NotFound(new { error = "nurse_not_found" });
        if (caller.Role == UserRole.Nurse && profile.UserId != callerId.Value)
            return Forbid();

        var yearStart = new DateOnly(DateTime.UtcNow.Year, 1, 1);
        var yearEnd = new DateOnly(DateTime.UtcNow.Year, 12, 31);

        var approved = await _db.LeaveRequests
            .Where(l => l.NurseProfileId == id && l.Status == LeaveStatus.Approved &&
                        l.StartDate <= yearEnd && l.EndDate >= yearStart)
            .Select(l => new { l.Type, l.StartDate, l.EndDate })
            .ToListAsync(ct);

        // Computed from approved requests — clamped to calendar year
        var byType = approved
            .GroupBy(l => l.Type.ToString())
            .ToDictionary(g => g.Key, g => g.Sum(l =>
            {
                var s = l.StartDate < yearStart ? yearStart : l.StartDate;
                var e = l.EndDate > yearEnd ? yearEnd : l.EndDate;
                return e.DayNumber - s.DayNumber + 1;
            }));

        return Ok(new { year = yearStart.Year, daysTakenByType = byType, totalDays = byType.Values.Sum() });
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

public record UpdateNurseRequest(
    string? Designation,
    EmploymentType? EmploymentType,
    EmploymentStatus? Status,
    string? LicenseNumber,
    string? LicenseAuthority,
    DateOnly? LicenseIssueDate,
    DateOnly? LicenseExpiryDate,
    string? NursingQualification,
    string? Institution,
    int? GraduationYear,
    string? Specialization,
    int? YearsExperience,
    string? Skills,
    string? Languages,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? EmergencyContactRelation,
    string? DocumentsJson,
    string? ShiftPreferencesJson,
    string? WorkRestrictionsJson,
    Guid? DepartmentId,
    Guid? WardId,
    Guid? SupervisorId);

public record SetAvailabilityRequest(
    [Required] DateOnly StartDate,
    [Required] DateOnly EndDate,
    [Required] ShiftPreference PreferredShift,
    Guid? PreferredWardId,
    bool NightShiftWilling,
    bool WeekendWilling,
    bool OvertimeWilling,
    string? Notes);

public record CreateLeaveRequest(
    DateOnly StartDate,
    DateOnly EndDate,
    LeaveType Type,
    string? Reason);

public record ReviewLeaveRequest(
    [Required] string Status,
    string? Note);

public record AcceptInviteRequest(
    [Required(ErrorMessage = "InviteToken is required")]
    string InviteToken,

    [Required(ErrorMessage = "Password is required"), MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    string Password);
