using Hospital_CRM.Infrastructure.Data;
using Hospital_CRM.Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/appointments")]
[AuthorizeRoles("Doctor", "ClinicAdmin")]
public class PrecheckReviewController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public PrecheckReviewController(HospitalCrmDbContext db) => _db = db;

    /// <summary>FR-23-03 — Doctor reviews pre-check submission inline in consult flow.</summary>
    [HttpGet("{id:guid}/precheck")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSubmission(Guid id, CancellationToken ct)
    {
        var submission = await _db.PrecheckSubmissions
            .FirstOrDefaultAsync(s => s.AppointmentId == id, ct);

        if (submission is null || submission.SubmittedAt is null)
            return Ok(new { submitted = false });

        return Ok(new
        {
            submitted = true,
            submittedAt = submission.SubmittedAt,
            chiefComplaint = submission.ChiefComplaint,
            symptomDuration = submission.SymptomDuration,
            medications = submission.Medications,
            allergies = submission.Allergies
        });
    }
}
