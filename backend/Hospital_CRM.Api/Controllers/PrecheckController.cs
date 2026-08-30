using System.Security.Cryptography;
using System.Text;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/precheck")]
public class PrecheckController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IConfiguration _config;
    private readonly INotificationService _notificationService;

    public PrecheckController(
        HospitalCrmDbContext db,
        IConfiguration config,
        INotificationService notificationService)
    {
        _db = db;
        _config = config;
        _notificationService = notificationService;
    }

    /// <summary>FR-23-02 — Patient submits pre-check form (unauthenticated, tokenized).</summary>
    [HttpPost("{token}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Submit(string token, [FromBody] PrecheckSubmissionRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { error = "invalid_token" });

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
        var submission = await _db.PrecheckSubmissions
            .FirstOrDefaultAsync(s => s.TokenHash == hash, ct);

        if (submission is null)
            return BadRequest(new { error = "invalid_token" });

        if (submission.SubmittedAt is not null)
            return Ok(new { message = "already_submitted" });

        if (DateTimeOffset.UtcNow > submission.ExpiresAt)
            return BadRequest(new { error = "token_expired" });

        submission.SubmittedAt = DateTimeOffset.UtcNow;
        submission.ChiefComplaint = request.ChiefComplaint;
        submission.SymptomDuration = request.SymptomDuration;
        submission.Medications = request.Medications;
        submission.Allergies = request.Allergies;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "submitted" });
    }
}

public record PrecheckSubmissionRequest(
    string? ChiefComplaint,
    string? SymptomDuration,
    string? Medications,
    string? Allergies
);