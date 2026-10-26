using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/queue-status")]
[EnableRateLimiting("queue-status")]
public class QueueStatusController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public QueueStatusController(HospitalCrmDbContext db) => _db = db;

    /// <summary>
    /// Section 1: Public queue tracker.
    /// Secured with an opaque, unguessable tracking token (or legacy numeric token fallback).
    /// Rate-limited to prevent brute-forcing.
    /// Exposes STRICTLY ZERO PHI: returns only yourToken, position in queue, estimatedWaitMinutes, and currentlyServing.
    /// </summary>
    [HttpGet("{token}")]
    public async Task<IActionResult> GetStatus(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || !token.StartsWith("qtrk_", StringComparison.Ordinal))
            return BadRequest(new { error = "invalid_token" });

        // Opaque token is the only credential. A numeric queue number is guessable, so it is
        // not accepted here: it would let anyone enumerate other clinics' queues.
        var appointment = await _db.Appointments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.QueueTrackingToken == token, ct);

        if (appointment is null)
            return NotFound(new { error = "token_not_found" });

        var doctorFilter = appointment.DoctorId;

        // Position: number of patients ahead of this appointment in the doctor's queue today
        var aheadCount = await _db.Appointments
            .IgnoreQueryFilters()
            .Where(a => a.DoctorId == doctorFilter &&
                        a.Date == appointment.Date &&
                        a.QueueToken != null &&
                        a.QueueToken < appointment.QueueToken &&
                        (a.Status == AppointmentStatus.CheckedIn || a.Status == AppointmentStatus.InNursing))
            .CountAsync(ct);

        var position = aheadCount + 1; // 1 means you are next
        var estimatedWaitMinutes = aheadCount * 15; // standard consultation benchmark: 15 min per patient ahead

        // Currently serving = smallest active token (InConsultation, InNursing, or CheckedIn)
        var currentlyServing = await _db.Appointments
            .IgnoreQueryFilters()
            .Where(a => a.DoctorId == doctorFilter &&
                        a.Date == appointment.Date &&
                        a.QueueToken != null &&
                        (a.Status == AppointmentStatus.InConsultation ||
                         a.Status == AppointmentStatus.InNursing ||
                         a.Status == AppointmentStatus.CheckedIn))
            .OrderBy(a => a.QueueToken)
            .Select(a => a.QueueToken)
            .FirstOrDefaultAsync(ct);

        return Ok(new
        {
            yourToken = appointment.QueueToken,
            position = position,
            estimatedWaitMinutes = estimatedWaitMinutes,
            currentlyServing = currentlyServing ?? appointment.QueueToken ?? 0,
            status = appointment.Status switch
            {
                AppointmentStatus.CheckedIn => "waiting",
                AppointmentStatus.InNursing => "in_nursing",
                AppointmentStatus.InConsultation => "in_consultation",
                AppointmentStatus.Completed => "completed",
                _ => "scheduled"
            }
        });
    }
}
