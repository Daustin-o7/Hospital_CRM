using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class LabOrdersController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IConfiguration _config;
    private readonly string _uploadDir;

    public LabOrdersController(HospitalCrmDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
        // Local disk storage for pilot. S3 swap is a config + DI change later.
        _uploadDir = config["Lab:UploadDir"] ?? "lab-uploads";
        Directory.CreateDirectory(_uploadDir);
    }

    // ----- FR-08-01: Create Lab Order -----

    [HttpPost("consultations/{id:guid}/lab-orders")]
    [AuthorizeRoles("Doctor")]
    public async Task<IActionResult> CreateOrder(Guid id, [FromBody] CreateLabOrderRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.TestName))
            return BadRequest(new { error = "test_name_required" });

        var consultation = await _db.Consultations
            .Include(c => c.Appointment)
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (consultation is null)
            return NotFound(new { error = "consultation_not_found" });

        var doctorId = User.GetUserId();
        if (!doctorId.HasValue) return Unauthorized(new { error = "invalid_token" });
        // FR-08-01 edge case: order stays linked to original consultation ID
        // (not affected by note amendments — we just store the ID, not a copy)
        var order = new LabOrder
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            ConsultationId = consultation.Id,
            PatientId = consultation.Appointment.PatientId,
            DoctorId = doctorId.Value,
            TestName = request.TestName,
            Notes = request.Notes,
            Status = LabOrderStatus.Ordered,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.LabOrders.Add(order);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = order.Id,
            testName = order.TestName,
            status = order.Status.ToString().ToLower(),
            createdAt = order.CreatedAt
        });
    }

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".jpg", ".jpeg", ".png", ".dcm", ".csv"
    };

    private const long MaxLabFileSizeBytes = 25 * 1024 * 1024; // 25 MB

    // ----- FR-08-02: Enter/Upload Lab Result -----

    [HttpPatch("lab-orders/{id:guid}/result")]
    [AuthorizeRoles("Doctor", "ClinicAdmin")]
    public async Task<IActionResult> EnterResult(Guid id, [FromForm] string? resultText, IFormFile? file, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(resultText) && file is null)
            return BadRequest(new { error = "result_text_or_file_required" });

        if (file is not null)
        {
            if (file.Length > MaxLabFileSizeBytes)
                return StatusCode(StatusCodes.Status413PayloadTooLarge, new { error = "file_too_large", maxSizeBytes = MaxLabFileSizeBytes });

            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
                return BadRequest(new { error = "file_type_not_allowed", allowedExtensions = AllowedExtensions });
        }

        var tenantId = Guid.Empty;
        var order = await _db.LabOrders.FirstOrDefaultAsync(o => o.Id == id && o.TenantId == tenantId, ct);
        if (order is null)
            return NotFound(new { error = "order_not_found" });

        // FR-08-02 edge case: correction = new version, original preserved
        var latest = await _db.LabResults
            .Where(r => r.LabOrderId == id)
            .OrderByDescending(r => r.Version)
            .FirstOrDefaultAsync(ct);
        var version = (latest?.Version ?? 0) + 1;

        string? fileUrl = null;
        if (file is not null)
        {
            // Local disk storage; swap for S3 in production (TRD-Phase2 §3)
            var ext = Path.GetExtension(file.FileName);
            var fileName = $"{id}_v{version}_{Guid.NewGuid():N}{ext}";
            var path = Path.Combine(_uploadDir, fileName);
            await using (var stream = System.IO.File.Create(path))
            {
                await file.CopyToAsync(stream, ct);
            }
            fileUrl = $"/lab-uploads/{fileName}";
        }


        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var result = new LabResult
        {
            Id = Guid.NewGuid(),
            LabOrderId = id,
            ResultText = resultText,
            FileUrl = fileUrl,
            Version = version,
            PreviousVersionId = latest?.Id,
            EnteredBy = userId.Value,
            EnteredAt = DateTimeOffset.UtcNow
        };
        _db.LabResults.Add(result);
        order.Status = LabOrderStatus.Completed;
        order.CompletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = result.Id,
            version = result.Version,
            previousVersionId = result.PreviousVersionId,
            resultText = result.ResultText,
            fileUrl = result.FileUrl,
            orderStatus = order.Status.ToString().ToLower()
        });
    }

    // ----- FR-08-03: Worklist -----

    [HttpGet("lab-orders")]
    [AuthorizeRoles("Doctor", "ClinicAdmin")]
    public async Task<IActionResult> Worklist([FromQuery] string? status, CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var query = _db.LabOrders.Where(o => o.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<LabOrderStatus>(status, true, out var statusEnum))
        {
            query = query.Where(o => o.Status == statusEnum);
        }

        // Pending list is the operationally important one — surface first
        var orders = await query
            .OrderBy(o => o.Status) // Ordered (0) before Completed (1)
            .ThenByDescending(o => o.CreatedAt)
            .Select(o => new
            {
                id = o.Id,
                consultationId = o.ConsultationId,
                patientId = o.PatientId,
                doctorId = o.DoctorId,
                testName = o.TestName,
                notes = o.Notes,
                status = o.Status.ToString().ToLower(),
                createdAt = o.CreatedAt,
                completedAt = o.CompletedAt,
                latestResultVersion = _db.LabResults
                    .Where(r => r.LabOrderId == o.Id)
                    .Max(r => (int?)r.Version)
            })
            .ToListAsync(ct);

        return Ok(orders);
    }
}

public record CreateLabOrderRequest(string TestName, string? Notes);
