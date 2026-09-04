using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/queue-status")]
public class QueueStatusController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public QueueStatusController(HospitalCrmDbContext db) => _db = db;

    [HttpGet("{token:int}")]
    public async Task<IActionResult> GetStatus(int token, [FromQuery] Guid? doctorId, CancellationToken ct)
    {
        var appointment = await _db.Appointments
            .FirstOrDefaultAsync(a => a.QueueToken == token, ct);

        if (appointment is null)
            return NotFound(new { error = "token_not_found" });

        // Currently serving = smallest queue_token >= 1 that is not cancelled
        var doctorFilter = doctorId ?? appointment.DoctorId;
        var queueTokens = await _db.Appointments
            .Where(a => a.DoctorId == doctorFilter &&
                        a.Date == appointment.Date &&
                        a.QueueToken != null &&
                        a.Status != Domain.Enums.AppointmentStatus.Cancelled)
            .Select(a => a.QueueToken!.Value)
            .OrderBy(x => x)
            .ToListAsync(ct);

        return Ok(new
        {
            currentlyServing = queueTokens.Count > 0 ? queueTokens.Min() : 0,
            yourToken = token
        });
    }
}
