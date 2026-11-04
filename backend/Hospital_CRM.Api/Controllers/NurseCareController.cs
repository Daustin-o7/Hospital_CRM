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
            TenantId = User.GetTenantId() ?? caller.TenantId ?? Guid.Empty,
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
            "created", null, $"patient:{request.PatientId}", callerId.Value, User.GetTenantId() ?? Guid.Empty, ct);

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
            .Include(a => a.Nurse).ThenInclude(n => n.User)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (assignment is null) return NotFound(new { error = "assignment_not_found" });

        if (caller.Role == UserRole.Nurse)
        {
            var own = await _db.NurseProfiles.Where(p => p.UserId == callerId.Value).Select(p => (Guid?)p.Id).FirstOrDefaultAsync(ct);
            if (assignment.NurseProfileId != own) return Forbid();
        }
        else if (assignment.Nurse.User.ClinicId != caller.ClinicId)
        {
            return Forbid();
        }

        assignment.Status = NurseAssignmentStatus.Completed;
        assignment.CompletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        await ShiftsController.LogAudit(_db, "PatientNurseAssignment", assignment.Id, assignment.NurseProfileId,
            "status", "Active", "Completed", callerId.Value, User.GetTenantId() ?? Guid.Empty, ct);

        return Ok(new { assignmentId = assignment.Id, status = assignment.Status.ToString() });
    }

    // Structured handover note - outgoing nurse -> incoming nurse.
    // Dual routes for both /api/v1/handovers and /api/v1/nurse-care/handovers for frontend parity
    [HttpPost("handovers")]
    [HttpPost("nurse-care/handovers")]
    [AuthorizeRoles("Nurse")]
    public async Task<IActionResult> CreateHandover([FromBody] CreateHandoverRequest request, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null) return Forbid();

        var whatHappened = !string.IsNullOrWhiteSpace(request.WhatHappened)
            ? request.WhatHappened.Trim()
            : request.Note?.Trim() ?? string.Empty;

        var whatIsPending = !string.IsNullOrWhiteSpace(request.WhatIsPending)
            ? request.WhatIsPending.Trim()
            : "None reported";

        if (string.IsNullOrWhiteSpace(whatHappened))
            return BadRequest(new { error = "what_happened_or_note_required" });

        var own = await _db.NurseProfiles
            .FirstOrDefaultAsync(p => p.UserId == callerId.Value && p.User.ClinicId == caller.ClinicId, ct);
        if (own is null) return Forbid();

        // If ToNurseProfileId is provided, validate it; otherwise auto-select the other nurse or self
        Guid targetNurseId;
        if (request.ToNurseProfileId.HasValue && request.ToNurseProfileId.Value != Guid.Empty)
        {
            var toNurse = await _db.NurseProfiles
                .FirstOrDefaultAsync(p => p.Id == request.ToNurseProfileId.Value && p.User.ClinicId == caller.ClinicId, ct);
            if (toNurse is null) return NotFound(new { error = "nurse_not_found" });
            targetNurseId = toNurse.Id;
        }
        else
        {
            var otherNurse = await _db.NurseProfiles
                .Where(p => p.Id != own.Id && p.User.ClinicId == caller.ClinicId)
                .Select(p => p.Id)
                .FirstOrDefaultAsync(ct);
            targetNurseId = otherNurse != Guid.Empty ? otherNurse : own.Id;
        }

        // If PatientId is provided, validate patient belongs to clinic; otherwise resolve active patient
        Guid targetPatientId;
        if (request.PatientId.HasValue && request.PatientId.Value != Guid.Empty)
        {
            var patient = await _db.Patients
                .FirstOrDefaultAsync(p => p.Id == request.PatientId.Value &&
                    (p.CreatedByUser.ClinicId == null || p.CreatedByUser.ClinicId == caller.ClinicId || p.Appointments.Any(a => a.ClinicId == caller.ClinicId)), ct);
            if (patient is null) return NotFound(new { error = "patient_not_found" });
            targetPatientId = patient.Id;
        }
        else
        {
            var activePatientId = await _db.PatientNurseAssignments
                .Where(a => a.NurseProfileId == own.Id && a.Status == NurseAssignmentStatus.Active)
                .Select(a => (Guid?)a.PatientId)
                .FirstOrDefaultAsync(ct);

            if (!activePatientId.HasValue)
            {
                activePatientId = await _db.Patients
                    .Where(p => p.CreatedByUser.ClinicId == caller.ClinicId || p.Appointments.Any(a => a.ClinicId == caller.ClinicId))
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => (Guid?)p.Id)
                    .FirstOrDefaultAsync(ct);
            }

            if (!activePatientId.HasValue)
                return BadRequest(new { error = "patient_required_for_handover" });

            targetPatientId = activePatientId.Value;
        }

        var handover = new ShiftHandover
        {
            Id = Guid.NewGuid(),
            TenantId = User.GetTenantId() ?? caller.TenantId ?? Guid.Empty,
            PatientId = targetPatientId,
            AuthorNurseProfileId = own.Id,
            ToNurseProfileId = targetNurseId,
            ShiftId = request.ShiftId,
            WhatHappened = whatHappened,
            WhatIsPending = whatIsPending,
            CriticalAlerts = request.CriticalAlerts?.Trim(),
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.ShiftHandovers.Add(handover);
        await _db.SaveChangesAsync(ct);
        await ShiftsController.LogAudit(_db, "ShiftHandover", handover.Id, own.Id, "created", null,
            $"patient:{targetPatientId}", callerId.Value, User.GetTenantId() ?? Guid.Empty, ct);

        return Ok(new { handoverId = handover.Id });
    }

    [HttpGet("handovers")]
    [HttpGet("nurse-care/handovers")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Nurse")]
    public async Task<IActionResult> ListHandovers([FromQuery] Guid? patientId, CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var caller = await _db.Users.FindAsync([callerId.Value], ct);
        if (caller?.ClinicId is null) return Forbid();

        var query = _db.ShiftHandovers.AsQueryable();

        if (patientId.HasValue && patientId.Value != Guid.Empty)
        {
            var patientExists = await _db.Patients
                .AnyAsync(p => p.Id == patientId.Value &&
                    (p.CreatedByUser.ClinicId == null || p.CreatedByUser.ClinicId == caller.ClinicId || p.Appointments.Any(a => a.ClinicId == caller.ClinicId)), ct);
            if (!patientExists)
                return NotFound(new { error = "patient_not_found" });

            query = query.Where(h => h.PatientId == patientId.Value);
        }
        else
        {
            query = query.Where(h => _db.Patients.Any(p => p.Id == h.PatientId &&
                (p.CreatedByUser.ClinicId == null || p.CreatedByUser.ClinicId == caller.ClinicId || p.Appointments.Any(a => a.ClinicId == caller.ClinicId))));
        }

        var rows = await query
            .OrderByDescending(h => h.CreatedAt)
            .Take(50)
            .Select(h => new
            {
                id = h.Id,
                patientId = h.PatientId,
                patientName = _db.Patients.Where(p => p.Id == h.PatientId).Select(p => p.Name).FirstOrDefault() ?? "General Ward",
                authorNurseProfileId = h.AuthorNurseProfileId,
                authorName = _db.NurseProfiles.Where(p => p.Id == h.AuthorNurseProfileId).Select(p => p.User.Name).FirstOrDefault() ?? "Staff Nurse",
                toNurseProfileId = h.ToNurseProfileId,
                toName = _db.NurseProfiles.Where(p => p.Id == h.ToNurseProfileId).Select(p => p.User.Name).FirstOrDefault() ?? "Duty Nurse",
                whatHappened = h.WhatHappened,
                whatIsPending = h.WhatIsPending,
                criticalAlerts = h.CriticalAlerts,
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
    Guid? PatientId,
    Guid? ToNurseProfileId,
    string? Note,
    string? WhatHappened,
    string? WhatIsPending,
    string? CriticalAlerts,
    Guid? ShiftId);