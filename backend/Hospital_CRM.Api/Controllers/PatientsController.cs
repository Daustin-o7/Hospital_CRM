using System.Security.Claims;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Api.Services.Typesense;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class PatientsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IPatientSearchService _search;

    public PatientsController(HospitalCrmDbContext db, IPatientSearchService search)
    {
        _db = db;
        _search = search;
    }

    [HttpPost]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> Register([FromBody] PatientRegisterRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Phone))
            return BadRequest(new { error = "name_and_phone_required" });

        if (request.Dob is null && request.ApproxAge is null)
            return BadRequest(new { error = "either_dob_or_approxAge_required" });

        if (request.Consent is null || !request.Consent.Accepted)
            return BadRequest(new { error = "consent_required" });

        // First check phone duplication
        var existingPatient = await _db.Patients
            .FirstOrDefaultAsync(p => p.Phone == request.Phone, ct);

        if (existingPatient is not null)
            return Ok(new { patientId = existingPatient.Id, possibleDuplicateOf = existingPatient.Id });

        // Then idempotency check
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await _db.Patients
                .FirstOrDefaultAsync(p => p.IdempotencyKey == request.IdempotencyKey, ct);
            if (existing is not null)
                return Ok(new { patientId = existing.Id, possibleDuplicateOf = (Guid?)null });
        }

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Phone = request.Phone,
            DobHasValue = request.Dob.HasValue,
            Dob = request.Dob,
            ApproxAge = request.ApproxAge,
            Gender = ParseGender(request.Gender),
            Address = request.Address,
            CreatedBy = userId.Value,
            CreatedAt = DateTimeOffset.UtcNow,
            IdempotencyKey = request.IdempotencyKey
        };

        var consent = new PatientConsent
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            Purpose = request.Consent.Purpose,
            CapturedBy = userId.Value,
            CapturedAt = DateTimeOffset.UtcNow
        };

        _db.Patients.Add(patient);
        _db.PatientConsents.Add(consent);
        await _db.SaveChangesAsync(ct);

        // Write-through to Typesense (non-blocking, fire-and-forget inside service)
        _ = _search.IndexAsync(patient, ct);

        return StatusCode(201, new
        {
            id = patient.Id,
            name = patient.Name,
            phone = patient.Phone,
            gender = patient.Gender.ToString(),
            dob = patient.Dob?.ToString("yyyy-MM-dd"),
            approxAge = patient.ApproxAge,
            address = patient.Address,
            createdAt = patient.CreatedAt,
            patientId = patient.Id,
            possibleDuplicateOf = (Guid?)null
        });
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAll(CancellationToken ct) => await Search(null, ct);

    [HttpGet("search")]
    [Authorize]
    public async Task<IActionResult> Search([FromQuery] string? q, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        // TenantId is Guid.Empty for single-tenant Phase 1
        var tenantId = Guid.Empty;

        if (string.IsNullOrWhiteSpace(q))
            return Ok(new List<object>());

        var hits = await _search.SearchAsync(q.Trim(), tenantId, limit: 10, ct);

        // Composite dropdown format: name + DOB + last 4 phone
        var results = hits.Select(h => new
        {
            id = h.Id,
            name = h.Name,
            dob = h.Dob,
            phoneLast4 = h.Phone.Length >= 4 ? h.Phone.Substring(h.Phone.Length - 4) : h.Phone,
            phone = h.Phone,
            gender = h.Gender,
            address = h.Address,
            score = h.Score
        });

        return Ok(results);
    }

    [HttpPost("check-duplicate")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> CheckDuplicate([FromBody] CheckDuplicateRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "name_required" });

        var tenantId = Guid.Empty;
        var hits = await _search.CheckDuplicatesAsync(request.Name, request.Phone, request.Dob, tenantId, ct);

        var potentialMatches = hits.Select(h => new
        {
            id = h.Id,
            name = h.Name,
            dob = h.Dob,
            phoneLast4 = h.Phone.Length >= 4 ? h.Phone.Substring(h.Phone.Length - 4) : h.Phone,
            phone = h.Phone,
            gender = h.Gender,
            address = h.Address,
            score = h.Score
        }).ToList();

        if (potentialMatches.Count == 0)
            return Ok(new { duplicate = false, matches = potentialMatches });

        return Ok(new
        {
            duplicate = true,
            matches = potentialMatches,
            message = "Potential duplicate patients found. Please confirm if this is the same patient."
        });
    }

    [HttpGet("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var patient = await _db.Patients
            .Include(p => p.Consents)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (patient is null)
            return NotFound(new { error = "patient_not_found" });

        var role = User.GetUserRole();
        var isReceptionist = string.Equals(role, "receptionist", StringComparison.OrdinalIgnoreCase);

        var result = new Dictionary<string, object?>
        {
            ["id"] = patient.Id,
            ["name"] = patient.Name,
            ["phone"] = patient.Phone,
            ["dobHasValue"] = patient.DobHasValue,
            ["dob"] = patient.Dob?.ToString("yyyy-MM-dd"),
            ["approxAge"] = patient.ApproxAge,
            ["gender"] = patient.Gender.ToString().ToLower(),
            ["address"] = patient.Address,
            ["createdAt"] = patient.CreatedAt
        };

        if (!isReceptionist)
        {
            var consultations = await _db.Consultations
                .Where(c => c.Appointment.PatientId == id)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    id = c.Id,
                    diagnosis = c.Diagnosis,
                    chiefComplaint = c.ChiefComplaint,
                    createdAt = c.CreatedAt
                })
                .ToListAsync(ct);

            result["consultations"] = consultations;
        }

        return Ok(result);
    }

    [HttpPatch("{id:guid}")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> Patch(Guid id, [FromBody] PatientPatchRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var patient = await _db.Patients.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (patient is null)
            return NotFound(new { error = "patient_not_found" });

        var now = DateTimeOffset.UtcNow;

        if (request.Phone is not null && request.Phone != patient.Phone)
        {
            var phoneTaken = await _db.Patients.AnyAsync(p => p.Phone == request.Phone && p.Id != id, ct);
            if (phoneTaken)
                return Conflict(new { error = "phone_already_in_use" });

            await AuditService.LogChangeAsync(_db, "Patient", id, userId.Value, "phone", patient.Phone, request.Phone, ct);
            patient.Phone = request.Phone;
        }

        if (request.Name is not null && request.Name != patient.Name)
        {
            await AuditService.LogChangeAsync(_db, "Patient", id, userId.Value, "name", patient.Name, request.Name, ct);
            patient.Name = request.Name;
        }

        if (request.Dob.HasValue && request.Dob.Value != patient.Dob)
        {
            var oldDob = patient.Dob?.ToString("yyyy-MM-dd") ?? "";
            var newDob = request.Dob.Value.ToString("yyyy-MM-dd");
            await AuditService.LogChangeAsync(_db, "Patient", id, userId.Value, "dob", oldDob, newDob, ct);
            patient.Dob = request.Dob;
            patient.DobHasValue = request.Dob.HasValue;
        }

        if (request.Gender is not null)
        {
            var newGender = ParseGender(request.Gender);
            if (newGender != patient.Gender)
            {
                await AuditService.LogChangeAsync(_db, "Patient", id, userId.Value, "gender", patient.Gender.ToString(), newGender.ToString(), ct);
                patient.Gender = newGender;
            }
        }

        if (request.Address is not null && request.Address != patient.Address)
        {
            await AuditService.LogChangeAsync(_db, "Patient", id, userId.Value, "address", patient.Address ?? "", request.Address, ct);
            patient.Address = request.Address;
        }

        await _db.SaveChangesAsync(ct);

        // Write-through to Typesense (non-blocking)
        _ = _search.IndexAsync(patient, ct);

        return Ok(new { patientId = patient.Id, updatedAt = now });
    }

    private static Gender ParseGender(string? gender)
    {
        return gender?.ToLower() switch
        {
            "male" => Gender.Male,
            "female" => Gender.Female,
            "other" => Gender.Other,
            _ => Gender.PreferNotToSay
        };
    }
}

public record PatientRegisterRequest(
    string Name,
    string Phone,
    DateOnly? Dob,
    int? ApproxAge,
    string? Gender,
    string? Address,
    ConsentRequest? Consent,
    string? IdempotencyKey);

public record ConsentRequest(bool Accepted, string Purpose);

public record PatientPatchRequest(
    string? Name,
    string? Phone,
    DateOnly? Dob,
    string? Gender,
    string? Address);

public record CheckDuplicateRequest(
    string Name,
    string? Phone,
    DateOnly? Dob);
