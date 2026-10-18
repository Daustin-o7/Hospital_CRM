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
[Route("api/v1")]
public class NurseCareController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<NurseCareController> _logger;

    public NurseCareController(HospitalCrmDbContext db, ILogger<NurseCareController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpPost("nurse-assignments")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Assign([FromBody] CreateAssignmentRequest request, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null) return Forbid();

        var patient = await _db.Patients
            .FirstOrDefaultAsync(p => p.Id == request.PatientId &&
                (p.CreatedByUser.ClinicId == null || p.CreatedByUser.ClinicId == caller.ClinicId || p.Appointments.Any(a => a.ClinicId == caller.ClinicId)), ct);
        if (patient is null) return NotFound(new { error = "patient_not_found" });

        var nurse = await _db.NurseProfiles
            .FirstOrDefaultAsync(p => p.Id == request.NurseProfileId && p.User.ClinicId == caller.ClinicId, ct);
        if (nurse is null) return NotFound(new { error = "nurse_not_found" });

        var alreadyActive = await _db.PatientNurseAssignments.AnyAsync(a =>
            a.PatientId == request.PatientId &&
            a.NurseProfileId == request.NurseProfileId &&
            a.Status == NurseAssignmentStatus.Active, ct);
        if (alreadyActive) return Conflict(new { error = "assignment_already_active" });

        var assignment = new PatientNurseAssignment
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            PatientId = request.PatientId,
            NurseProfileId = request.NurseProfileId,
            AppointmentId = request.AppointmentId,
            ShiftId = request.ShiftId,
            Status = NurseAssignmentStatus.Active,
            AssignedAt = DateTimeOffset.UtcNow,
            AssignedBy = callerId.Value
        };

        _db.PatientNurseAssignments.Add(assignment);
        await _db.SaveChangesAsync(ct);
        await ShiftsController.LogAudit(_db, "PatientNurseAssignment", assignment.Id, request.NurseProfileId,
            "created", null, $"patient:{request.PatientId}", callerId.Value, ct);

        return Ok(new { assignmentId = assignment.Id, status = assignment.Status.ToString() });
    }

    [HttpGet("nurse-assignments")]
    [AuthorizeRoles("ClinicAdmin", "Nurse")]
    public async Task<IActionResult> List([FromQuery] Guid? patientId, [FromQuery] bool activeOnly, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null) return Forbid();

        var query = _db.PatientNurseAssignments.AsQueryable();

        if (caller.Role == UserRole.Nurse)
        {
            var own = await _db.NurseProfiles.Where(p => p.UserId == callerId.Value).Select(p => (Guid?)p.Id).FirstOrDefaultAsync(ct);
            if (own is null) return Forbid();
            query = query.Where(a => a.NurseProfileId == own);
        }
        else
        {
            query = query.Where(a => a.Nurse.User.ClinicId == caller.ClinicId);
        }

        if (patientId.HasValue)
            query = query.Where(a => a.PatientId == patientId.Value);
        if (activeOnly)
            query = query.Where(a => a.Status == NurseAssignmentStatus.Active);

        var rows = await query
            .OrderByDescending(a => a.AssignedAt)
            .Take(200)
            .Select(a => new
            {
                id = a.Id,
                patientId = a.PatientId,
                nurseProfileId = a.NurseProfileId,
                nurseName = a.Nurse.User.Name,
                appointmentId = a.AppointmentId,
                status = a.Status.ToString(),
                assignedAt = a.AssignedAt
            })
            .ToListAsync(ct);

        return Ok(rows);
    }

    [HttpPost("nurse-assignments/{id:guid}/complete")]
    [AuthorizeRoles("ClinicAdmin", "Nurse")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null) return Forbid();

        var assignment = await _db.PatientNurseAssignments
            .FirstOrDefaultAsync(a => a.Id == id &&
                a.Nurse.User.ClinicId == caller.ClinicId &&
                (caller.Role != UserRole.Nurse || a.Nurse.UserId == callerId.Value), ct);
        if (assignment is null) return NotFound(new { error = "assignment_not_found" });
        if (assignment.Status != NurseAssignmentStatus.Active)
            return Conflict(new { error = "assignment_not_active" });

        assignment.Status = NurseAssignmentStatus.Completed;
        assignment.CompletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        await ShiftsController.LogAudit(_db, "PatientNurseAssignment", assignment.Id, assignment.NurseProfileId,
            "completed", "Active", "Completed", callerId.Value, ct);

        return Ok(new { assignmentId = assignment.Id, status = assignment.Status.ToString() });
    }

    // Single free-text handover note — outgoing nurse → incoming nurse.
    [HttpPost("handovers")]
    [AuthorizeRoles("Nurse")]
    public async Task<IActionResult> CreateHandover([FromBody] CreateHandoverRequest request, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null) return Forbid();

        if (string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { error = "note_required" });

        var own = await _db.NurseProfiles
            .FirstOrDefaultAsync(p => p.UserId == callerId.Value && p.User.ClinicId == caller.ClinicId, ct);
        if (own is null) return Forbid();

        var toNurse = await _db.NurseProfiles
            .FirstOrDefaultAsync(p => p.Id == request.ToNurseProfileId && p.User.ClinicId == caller.ClinicId, ct);
        if (toNurse is null) return NotFound(new { error = "nurse_not_found" });

        var patient = await _db.Patients
            .FirstOrDefaultAsync(p => p.Id == request.PatientId &&
                (p.CreatedByUser.ClinicId == null || p.CreatedByUser.ClinicId == caller.ClinicId || p.Appointments.Any(a => a.ClinicId == caller.ClinicId)), ct);
        if (patient is null) return NotFound(new { error = "patient_not_found" });

        var handover = new ShiftHandover
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            PatientId = request.PatientId,
            AuthorNurseProfileId = own.Id,
            ToNurseProfileId = request.ToNurseProfileId,
            ShiftId = request.ShiftId,
            Note = request.Note.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.ShiftHandovers.Add(handover);
        await _db.SaveChangesAsync(ct);
        await ShiftsController.LogAudit(_db, "ShiftHandover", handover.Id, own.Id, "created", null,
            $"patient:{request.PatientId}", callerId.Value, ct);

        return Ok(new { handoverId = handover.Id });
    }

    [HttpGet("handovers")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Nurse")]
    public async Task<IActionResult> ListHandovers([FromQuery] Guid patientId, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null) return Forbid();

        var patientExists = await _db.Patients
            .AnyAsync(p => p.Id == patientId &&
                (p.CreatedByUser.ClinicId == null || p.CreatedByUser.ClinicId == caller.ClinicId || p.Appointments.Any(a => a.ClinicId == caller.ClinicId)), ct);
        if (!patientExists)
            return NotFound(new { error = "patient_not_found" });

        var rows = await _db.ShiftHandovers
            .Where(h => h.PatientId == patientId)
            .OrderByDescending(h => h.CreatedAt)
            .Take(50)
            .Select(h => new
            {
                id = h.Id,
                patientId = h.PatientId,
                authorNurseProfileId = h.AuthorNurseProfileId,
                authorName = _db.NurseProfiles.Where(p => p.Id == h.AuthorNurseProfileId).Select(p => p.User.Name).FirstOrDefault(),
                toNurseProfileId = h.ToNurseProfileId,
                toName = _db.NurseProfiles.Where(p => p.Id == h.ToNurseProfileId).Select(p => p.User.Name).FirstOrDefault(),
                note = h.Note,
                createdAt = h.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(rows);
    }
}

public record CreateAssignmentRequest(
    Guid PatientId,
    Guid NurseProfileId,
    Guid? AppointmentId,
    Guid? ShiftId);

public record CreateHandoverRequest(
    Guid PatientId,
    Guid ToNurseProfileId,
    string Note,
    Guid? ShiftId);
