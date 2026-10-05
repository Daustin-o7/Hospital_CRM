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
[Route("api/v1/shifts")]
public class ShiftsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<ShiftsController> _logger;

    public ShiftsController(HospitalCrmDbContext db, ILogger<ShiftsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // Admin posts a shift; with nurseProfileId it lands straight on the roster, without it it's open for applications.
    [HttpPost]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Create([FromBody] CreateShiftRequest request, CancellationToken ct)
    {
        var caller = RequireUser(out var error);
        if (caller is null) return Unauthorized(new { error });

        var clinicId = caller!.ClinicId;
        if (clinicId is null) return Forbid();

        if (request.Date < DateOnly.FromDateTime(DateTime.UtcNow))
            return BadRequest(new { error = "shift_date_in_past" });

        Guid? nurseProfileId = null;
        if (request.NurseProfileId.HasValue)
        {
            var conflict = await CheckAssignmentConflicts(request.NurseProfileId.Value, request.Date, request.ShiftType, excludeShiftId: null, ct);
            if (conflict != null) return Conflict(new { error = conflict });
            nurseProfileId = request.NurseProfileId;
        }

        var shift = new NurseShift
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            ClinicId = clinicId.Value,
            Date = request.Date,
            ShiftType = request.ShiftType,
            Status = nurseProfileId.HasValue ? ShiftStatus.Assigned : ShiftStatus.Open,
            NurseProfileId = nurseProfileId,
            Notes = request.Notes ?? string.Empty,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            CreatedBy = caller.Id
        };

        _db.NurseShifts.Add(shift);
        await _db.SaveChangesAsync(ct);
        await LogAudit(_db, "NurseShift", shift.Id, nurseProfileId, "created", null,
            $"{shift.Date:yyyy-MM-dd} {shift.ShiftType}" + (nurseProfileId.HasValue ? " assigned" : " open"), caller.Id, ct);

        return Ok(new { shiftId = shift.Id, status = shift.Status.ToString() });
    }

    [HttpGet]
    [AuthorizeRoles("ClinicAdmin", "Nurse")]
    public async Task<IActionResult> List([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        var caller = RequireUser(out var error);
        if (caller is null) return Unauthorized(new { error });
        if (caller?.ClinicId is null) return Forbid();

        var until = to ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var since = from ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7));

        var query = _db.NurseShifts
            .Where(s => s.ClinicId == caller.ClinicId && s.Date >= since && s.Date <= until);

        Guid? meProfileId = null;
        if (caller.Role == UserRole.Nurse)
        {
            meProfileId = await OwnProfileId(caller.Id, ct);
            if (meProfileId is null) return Forbid();
            query = query.Where(s =>
                s.Status == ShiftStatus.Open ||
                (s.NurseProfileId != null && s.NurseProfileId == meProfileId));
        }

        var mine = meProfileId;
        var shifts = await query
            .OrderBy(s => s.Date)
            .ThenBy(s => s.ShiftType)
            .Select(s => new
            {
                id = s.Id,
                date = s.Date,
                shiftType = s.ShiftType.ToString(),
                status = s.Status.ToString(),
                notes = s.Notes,
                nurseProfileId = s.NurseProfileId,
                nurseName = s.Nurse != null ? s.Nurse.User.Name : null,
                nurseEmail = s.Nurse != null ? s.Nurse.User.Email : null,
                appliedCount = s.Applications.Count(a => a.Status == ShiftApplicationStatus.Applied),
                appliedByMe = mine != null && s.Applications.Any(a => a.NurseProfileId == mine && a.Status == ShiftApplicationStatus.Applied)
            })
            .ToListAsync(ct);

        return Ok(shifts);
    }

    // Assign / reassign / reopen / cancel.
    [HttpPut("{id:guid}")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateShiftRequest request, CancellationToken ct)
    {
        var caller = RequireUser(out var error);
        if (caller is null) return Unauthorized(new { error });

        var shift = await _db.NurseShifts.FirstOrDefaultAsync(s => s.Id == id && s.ClinicId == caller.ClinicId, ct);
        if (shift is null) return NotFound(new { error = "shift_not_found" });

        var old = $"{shift.Status}/{shift.NurseProfileId}";

        if (request.Cancel == true)
        {
            shift.Status = ShiftStatus.Cancelled;
            shift.NurseProfileId = null;
        }
        else if (request.NurseProfileId.HasValue)
        {
            var conflict = await CheckAssignmentConflicts(request.NurseProfileId.Value, shift.Date, shift.ShiftType, excludeShiftId: shift.Id, ct);
            if (conflict != null) return Conflict(new { error = conflict });
            shift.NurseProfileId = request.NurseProfileId;
            shift.Status = ShiftStatus.Assigned;
        }
        else
        {
            // Explicit null nurse = reopen as open shift
            shift.NurseProfileId = null;
            shift.Status = ShiftStatus.Open;
        }

        if (!string.IsNullOrWhiteSpace(request.Notes))
            shift.Notes = request.Notes;

        shift.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        await LogAudit(_db, "NurseShift", shift.Id, shift.NurseProfileId, "updated", old,
            $"{shift.Status}/{shift.NurseProfileId}", caller.Id, ct);

        return Ok(new { shiftId = shift.Id, status = shift.Status.ToString(), nurseProfileId = shift.NurseProfileId });
    }

    // Nurse applies for an open shift.
    [HttpPost("{id:guid}/applications")]
    [AuthorizeRoles("Nurse")]
    public async Task<IActionResult> Apply(Guid id, CancellationToken ct)
    {
        var caller = RequireUser(out var error);
        if (caller is null) return Unauthorized(new { error });

        var profileId = await OwnProfileId(caller.Id, ct);
        if (profileId is null) return Forbid();

        var shift = await _db.NurseShifts.FirstOrDefaultAsync(s => s.Id == id && s.ClinicId == caller.ClinicId, ct);
        if (shift is null) return NotFound(new { error = "shift_not_found" });
        if (shift.Status != ShiftStatus.Open)
            return Conflict(new { error = "shift_not_open" });

        var conflict = await CheckAssignmentConflicts(profileId.Value, shift.Date, shift.ShiftType, excludeShiftId: null, ct);
        if (conflict != null) return Conflict(new { error = conflict });

        var existing = await _db.NurseShiftApplications
            .FirstOrDefaultAsync(a => a.ShiftId == id && a.NurseProfileId == profileId, ct);
        if (existing != null)
        {
            if (existing.Status == ShiftApplicationStatus.Withdrawn)
            {
                // Re-apply after withdraw: reactivate the same row (amend, not duplicate).
                existing.Status = ShiftApplicationStatus.Applied;
                existing.AppliedAt = DateTimeOffset.UtcNow;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
                await _db.SaveChangesAsync(ct);
                await LogAudit(_db, "NurseShiftApplication", existing.Id, profileId, "reapplied", "Withdrawn", "Applied", caller.Id, ct);
                return Ok(new { applicationId = existing.Id });
            }
            return Conflict(new { error = "already_applied" });
        }

        var application = new NurseShiftApplication
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            ShiftId = id,
            NurseProfileId = profileId.Value,
            Status = ShiftApplicationStatus.Applied,
            AppliedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        _db.NurseShiftApplications.Add(application);
        await _db.SaveChangesAsync(ct);
        await LogAudit(_db, "NurseShiftApplication", application.Id, profileId, "created", null, $"applied:{id}", caller.Id, ct);

        return Ok(new { applicationId = application.Id });
    }

    // Nurse withdraws their own pending application (re-appliable while the shift stays open).
    // A nurse has at most one application per shift, so it's resolved server-side.
    [HttpPost("{id:guid}/applications/withdraw")]
    [AuthorizeRoles("Nurse")]
    public async Task<IActionResult> Withdraw(Guid id, CancellationToken ct)
    {
        var caller = RequireUser(out var error);
        if (caller is null) return Unauthorized(new { error });

        var profileId = await OwnProfileId(caller.Id, ct);
        if (profileId is null) return Forbid();

        var application = await _db.NurseShiftApplications
            .FirstOrDefaultAsync(a => a.ShiftId == id && a.NurseProfileId == profileId, ct);
        if (application is null) return NotFound(new { error = "application_not_found" });
        if (application.Status != ShiftApplicationStatus.Applied)
            return Conflict(new { error = "application_not_withdrawable" });

        application.Status = ShiftApplicationStatus.Withdrawn;
        application.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        await LogAudit(_db, "NurseShiftApplication", application.Id, profileId, "withdrawn", "Applied", "Withdrawn", caller.Id, ct);

        return Ok(new { applicationId = application.Id, status = "Withdrawn" });
    }

    [HttpGet("{id:guid}/applications")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> ListApplications(Guid id, CancellationToken ct)
    {
        var caller = RequireUser(out var error);
        if (caller is null) return Unauthorized(new { error });

        var apps = await _db.NurseShiftApplications
            .Where(a => a.ShiftId == id && a.Shift.ClinicId == caller.ClinicId)
            .OrderByDescending(a => a.AppliedAt)
            .Select(a => new
            {
                id = a.Id,
                status = a.Status.ToString(),
                appliedAt = a.AppliedAt,
                nurseProfileId = a.NurseProfileId,
                nurseName = a.Nurse.User.Name,
                nurseEmail = a.Nurse.User.Email,
                designation = a.Nurse.Designation,
                specialization = a.Nurse.Specialization
            })
            .ToListAsync(ct);

        return Ok(apps);
    }

    // Admin picks an applicant: shift becomes assigned, others are rejected.
    [HttpPost("{id:guid}/applications/{applicationId:guid}/select")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Select(Guid id, Guid applicationId, CancellationToken ct)
    {
        var caller = RequireUser(out var error);
        if (caller is null) return Unauthorized(new { error });

        var shift = await _db.NurseShifts.FirstOrDefaultAsync(s => s.Id == id && s.ClinicId == caller.ClinicId, ct);
        if (shift is null) return NotFound(new { error = "shift_not_found" });
        if (shift.Status != ShiftStatus.Open)
            return Conflict(new { error = "shift_not_open" });

        var application = await _db.NurseShiftApplications
            .FirstOrDefaultAsync(a => a.Id == applicationId && a.ShiftId == id && a.Status == ShiftApplicationStatus.Applied, ct);
        if (application is null) return NotFound(new { error = "application_not_found" });

        var conflict = await CheckAssignmentConflicts(application.NurseProfileId, shift.Date, shift.ShiftType, excludeShiftId: shift.Id, ct);
        if (conflict != null) return Conflict(new { error = conflict });

        shift.NurseProfileId = application.NurseProfileId;
        shift.Status = ShiftStatus.Assigned;
        shift.UpdatedAt = DateTimeOffset.UtcNow;

        application.Status = ShiftApplicationStatus.Selected;
        application.UpdatedAt = DateTimeOffset.UtcNow;

        var others = await _db.NurseShiftApplications
            .Where(a => a.ShiftId == id && a.Id != applicationId && a.Status == ShiftApplicationStatus.Applied)
            .ToListAsync(ct);
        foreach (var other in others)
        {
            other.Status = ShiftApplicationStatus.Rejected;
            other.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        await LogAudit(_db, "NurseShift", shift.Id, shift.NurseProfileId, "assigned", null,
            $"application:{applicationId}", caller.Id, ct);

        return Ok(new { shiftId = shift.Id, nurseProfileId = shift.NurseProfileId, rejected = others.Count });
    }

    private User? RequireUser(out string error)
    {
        error = "invalid_token";
        var userId = User.GetUserId();
        if (!userId.HasValue) return null;
        var user = _db.Users.Find(userId.Value);
        if (user is null || user.ClinicId is null) return null;
        error = string.Empty;
        return user;
    }

    private async Task<Guid?> OwnProfileId(Guid userId, CancellationToken ct) =>
        await _db.NurseProfiles.Where(p => p.UserId == userId).Select(p => (Guid?)p.Id).FirstOrDefaultAsync(ct);

    // Returns null when clean, otherwise the conflict error code to return as 409.
    private async Task<string?> CheckAssignmentConflicts(Guid nurseProfileId, DateOnly date, ShiftType shiftType, Guid? excludeShiftId, CancellationToken ct)
    {
        var duplicate = await _db.NurseShifts.AnyAsync(s =>
            s.NurseProfileId == nurseProfileId &&
            s.Date == date &&
            s.ShiftType == shiftType &&
            s.Status == ShiftStatus.Assigned &&
            s.Id != excludeShiftId, ct);
        if (duplicate) return "nurse_already_assigned";

        var onLeave = await _db.LeaveRequests.AnyAsync(l =>
            l.NurseProfileId == nurseProfileId &&
            l.Status == LeaveStatus.Approved &&
            l.StartDate <= date &&
            l.EndDate >= date, ct);
        if (onLeave) return "nurse_on_leave";

        return null;
    }

    internal static async Task LogAudit(HospitalCrmDbContext db, string entityType, Guid entityId, Guid? nurseProfileId,
        string action, string? oldValue, string newValue, Guid changedBy, CancellationToken ct)
    {
        db.NurseAuditLogs.Add(new NurseAuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            EntityType = entityType,
            EntityId = entityId,
            NurseProfileId = nurseProfileId,
            Action = action,
            OldValue = oldValue ?? string.Empty,
            NewValue = newValue ?? string.Empty,
            ChangedBy = changedBy,
            ChangedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync(ct);
    }
}

public record CreateShiftRequest(
    DateOnly Date,
    ShiftType ShiftType,
    Guid? NurseProfileId,
    string? Notes);

public record UpdateShiftRequest(
    Guid? NurseProfileId,
    bool? Cancel,
    string? Notes);
