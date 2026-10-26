using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Api.Services.Typesense;
using Hospital_CRM.Domain.Constants;
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
    [RequirePermission(Permissions.PatientWrite)]
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

        // 1. Same person = phone AND name AND date of birth. Name alone is not enough:
        //    Indian families share one phone and relatives can share a name.
        var sameNameAndPhone = await _db.Patients
            .FirstOrDefaultAsync(p => p.Phone == request.Phone && p.Name.ToLower() == request.Name.Trim().ToLower(), ct);

        if (sameNameAndPhone is not null && request.Dob.HasValue && sameNameAndPhone.Dob == request.Dob)
            return Ok(new { patientId = sameNameAndPhone.Id, possibleDuplicateOf = sameNameAndPhone.Id, uhid = sameNameAndPhone.Uhid });

        // 2. Family phone sharing check: allow multiple patients per phone if confirmed
        if (!request.ConfirmDifferentPersonOnSamePhone)
        {
            var familyMember = sameNameAndPhone
                ?? await _db.Patients.FirstOrDefaultAsync(p => p.Phone == request.Phone, ct);

            if (familyMember is not null)
            {
                return Ok(new
                {
                    patientId = (Guid?)null,
                    sharedPhoneDetected = true,
                    existingFamilyMemberName = familyMember.Name,
                    existingPatientId = familyMember.Id,
                    message = $"Phone number {request.Phone} is already registered under '{familyMember.Name}'. Pass confirmDifferentPersonOnSamePhone: true to register as a family member."
                });
            }
        }

        // 3. Idempotency check
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await _db.Patients
                .FirstOrDefaultAsync(p => p.IdempotencyKey == request.IdempotencyKey, ct);
            if (existing is not null)
                return Ok(new { patientId = existing.Id, possibleDuplicateOf = (Guid?)null, uhid = existing.Uhid });
        }

        // 4. Generate per-clinic human-readable UHID (sequential per tenant + month)
        var uhid = await NextUhidAsync(ct);

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Uhid = uhid,
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

        // 5. Versioned DPDP Treatment Consent record
        var consent = new PatientConsent
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            Purpose = request.Consent.Purpose,
            NoticeVersion = string.IsNullOrWhiteSpace(request.NoticeVersion) ? "v1.0" : request.NoticeVersion,
            Language = string.IsNullOrWhiteSpace(request.Language) ? "en" : request.Language,
            CaptureMethod = string.IsNullOrWhiteSpace(request.CaptureMethod) ? "receptionist_assisted" : request.CaptureMethod,
            GuardianName = request.GuardianName,
            GuardianRelationship = request.GuardianRelationship,
            CapturedBy = userId.Value,
            CapturedAt = DateTimeOffset.UtcNow
        };

        _db.Patients.Add(patient);
        _db.PatientConsents.Add(consent);

        // Separate WhatsApp opt-in consent record
        if (request.WhatsAppOptIn)
        {
            var whatsappConsent = new PatientConsent
            {
                Id = Guid.NewGuid(),
                PatientId = patient.Id,
                Purpose = "whatsapp_opt_in",
                NoticeVersion = string.IsNullOrWhiteSpace(request.NoticeVersion) ? "v1.0" : request.NoticeVersion,
                Language = string.IsNullOrWhiteSpace(request.Language) ? "en" : request.Language,
                CaptureMethod = string.IsNullOrWhiteSpace(request.CaptureMethod) ? "receptionist_assisted" : request.CaptureMethod,
                GuardianName = request.GuardianName,
                GuardianRelationship = request.GuardianRelationship,
                CapturedBy = userId.Value,
                CapturedAt = DateTimeOffset.UtcNow
            };
            _db.PatientConsents.Add(whatsappConsent);
        }

        // A concurrent registration can take the same number between read and write;
        // the unique index rejects it, so take the next one instead of failing the desk.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await _db.SaveChangesAsync(ct);
                break;
            }
            catch (DbUpdateException ex) when (ex.IsUniqueViolation() && attempt < 3)
            {
                patient.Uhid = await NextUhidAsync(ct);
            }
        }

        return StatusCode(201, new
        {
            id = patient.Id,
            uhid = patient.Uhid,
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
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    [RequirePermission(Permissions.PatientsRead)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var patients = await _db.Patients.AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .Take(1000)
            .ToListAsync(ct);

        return Ok(patients.Select(patient => new
        {
            id = patient.Id,
            uhid = patient.Uhid,
            name = patient.Name,
            phone = patient.Phone,
            gender = patient.Gender.ToString(),
            dob = patient.Dob?.ToString("yyyy-MM-dd"),
            approxAge = patient.ApproxAge,
            address = patient.Address,
            createdAt = patient.CreatedAt,
            patientId = patient.Id
        }));
    }

    [HttpGet("search")]
    [Authorize]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist", "Nurse")]
    [RequirePermission(Permissions.PatientsRead)]
    public async Task<IActionResult> Search([FromQuery] string? q, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var tenantId = User.GetTenantId() ?? Guid.Empty;

        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
            return BadRequest(new { error = "query_too_short_min_2_chars", message = "Patient search query must be at least 2 characters." });

        var term = q.Trim();
        if (term.Length > 255) term = term[..255];

        // PHI access audit log
        _db.PatientAuditLogs.Add(new PatientAuditLog
        {
            Id = Guid.NewGuid(),
            PatientId = Guid.Empty,
            FieldName = "SEARCH",
            OldValue = string.Empty,
            NewValue = term,
            ChangedBy = userId.Value,
            ChangedAt = DateTimeOffset.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        var hits = await _search.SearchAsync(term, tenantId, limit: 10, ct);

        // Composite dropdown format: name + DOB + last 4 phone (Zero excess PHI)
        var results = hits.Select(h => new
        {
            id = h.Id,
            name = h.Name,
            dob = h.Dob,
            phoneLast4 = h.Phone.Length >= 4 ? h.Phone.Substring(h.Phone.Length - 4) : h.Phone,
            gender = h.Gender,
            score = h.Score
        });

        return Ok(results);
    }

    [HttpPost("{id:guid}/consents/{consentId:guid}/withdraw")]
    [AuthorizeRoles("ClinicAdmin", "Receptionist")]
    public async Task<IActionResult> WithdrawConsent(Guid id, Guid consentId, CancellationToken ct)
    {
        var consent = await _db.PatientConsents
            .FirstOrDefaultAsync(c => c.Id == consentId && c.PatientId == id, ct);
        if (consent is null)
            return NotFound(new { error = "consent_not_found" });

        consent.WithdrawnAt = DateTimeOffset.UtcNow;

        // Consent withdrawal is a DPDP event: prove who withdrew it and when.
        _db.PatientAuditLogs.Add(new PatientAuditLog
        {
            Id = Guid.NewGuid(),
            PatientId = consent.PatientId,
            FieldName = "CONSENT_WITHDRAWN",
            OldValue = consent.Purpose,
            NewValue = consent.WithdrawnAt.Value.ToString("O"),
            ChangedBy = User.GetUserId()!.Value,
            ChangedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "consent_withdrawn", consentId = consent.Id, withdrawnAt = consent.WithdrawnAt });
    }

    [HttpPost("check-duplicate")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> CheckDuplicate([FromBody] CheckDuplicateRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "name_required" });

        var tenantId = User.GetTenantId() ?? Guid.Empty;
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
    [RequirePermission(Permissions.PatientsRead)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var patient = await _db.Patients
            .Include(p => p.Consents)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (patient is null)
            return NotFound(new { error = "patient_not_found" });

        // Clinical-data scope: a doctor needs a treating relationship, not just the tenant.
        if (IsDoctor() && !await DoctorMayAccessPatientAsync(id, patient.CreatedBy, ct))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "clinical_access_denied",
                breakGlassRequired = true,
                patientId = patient.Id
            });
        }

        return Ok(await BuildPatientDetailAsync(patient, ct));
    }

    /// <summary>
    /// Emergency override for a clinician with no treating relationship. Every use is
    /// written to the append-only patient audit trail and the auth audit log.
    /// </summary>
    [HttpPost("{id:guid}/break-glass")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Nurse")]
    public async Task<IActionResult> BreakGlass(Guid id, [FromBody] BreakGlassRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        if (string.IsNullOrWhiteSpace(request.ReasonCode))
            return BadRequest(new { error = "reason_code_required" });

        var patient = await _db.Patients.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (patient is null)
            return NotFound(new { error = "patient_not_found" });

        var detail = $"{request.ReasonCode.Trim()}: {request.Reason?.Trim()}";

        _db.PatientAuditLogs.Add(new PatientAuditLog
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            FieldName = "BreakGlassAccess",
            OldValue = string.Empty,
            NewValue = detail,
            ChangedBy = userId.Value,
            ChangedAt = DateTimeOffset.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        await AuthAudit.LogAsync(_db, HttpContext, AuthEvent.BreakGlass, "success",
            userId.Value, User.GetTenantId(), User.FindFirst("email")?.Value, detail, ct);

        return Ok(await BuildPatientDetailAsync(patient, ct));
    }

    /// <summary>
    /// Next human-readable UHID for this tenant and month. Sequential rather than random:
    /// 9000 random 4-digit values collide long before a clinic's monthly volume.
    /// Tenant scope comes from the global query filter, not a hand-written predicate.
    /// </summary>
    private async Task<string> NextUhidAsync(CancellationToken ct)
    {
        var prefix = $"UHID-{DateTime.UtcNow:yyyyMM}-";
        var last = await _db.Patients
            .Where(p => p.Uhid != null && p.Uhid.StartsWith(prefix))
            .OrderByDescending(p => p.Uhid)
            .Select(p => p.Uhid)
            .FirstOrDefaultAsync(ct);

        var next = 1;
        if (last is not null && int.TryParse(last[prefix.Length..], out var parsed))
            next = parsed + 1;

        return $"{prefix}{next:D4}";
    }

    private bool IsDoctor() =>
        string.Equals(User.GetUserRole(), "Doctor", StringComparison.OrdinalIgnoreCase);

    private Task<bool> DoctorMayAccessPatientAsync(Guid patientId, Guid createdBy, CancellationToken ct)
    {
        var doctorId = User.GetUserId();
        if (!doctorId.HasValue)
            return Task.FromResult(false);

        if (createdBy == doctorId.Value)
            return Task.FromResult(true);

        return _db.Appointments.AnyAsync(
            a => a.PatientId == patientId && a.DoctorId == doctorId.Value, ct);
    }

    private async Task<Dictionary<string, object?>> BuildPatientDetailAsync(Patient patient, CancellationToken ct)
    {
        var isReceptionist = string.Equals(User.GetUserRole(), "receptionist", StringComparison.OrdinalIgnoreCase);

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
            result["consultations"] = await _db.Consultations
                .Where(c => c.Appointment.PatientId == patient.Id)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    id = c.Id,
                    diagnosis = c.Diagnosis,
                    chiefComplaint = c.ChiefComplaint,
                    createdAt = c.CreatedAt
                })
                .ToListAsync(ct);
        }

        return result;
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

        // Typesense write-through is handled asynchronously by the nightly Hangfire reindex job.
        // Removed fire-and-forget IndexAsync to avoid cancellation-on-request-end issues;
        // the reindex job will reconcile any unsynced patients.

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
    [Required(ErrorMessage = "Patient Name is required"), StringLength(100, MinimumLength = 2, ErrorMessage = "Patient Name must be between 2 and 100 characters")]
    string Name,

    [Required(ErrorMessage = "Phone number is required"), RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Phone number must be a valid 10-digit mobile number")]
    string Phone,

    DateOnly? Dob,

    [Range(0, 130, ErrorMessage = "Approximate Age must be between 0 and 130")]
    int? ApproxAge,

    string? Gender,

    [StringLength(500, ErrorMessage = "Address cannot exceed 500 characters")]
    string? Address,

    [Required(ErrorMessage = "Patient consent is mandatory for registration")]
    ConsentRequest? Consent,

    [RegularExpression(@"^IDEMP-PAT-[a-zA-Z0-9\-]+$", ErrorMessage = "IdempotencyKey must follow format IDEMP-PAT-{UUID}")]
    string? IdempotencyKey,

    bool WhatsAppOptIn = false,
    string? GuardianName = null,
    string? GuardianRelationship = null,
    string? NoticeVersion = null,
    string? Language = null,
    string? CaptureMethod = null,
    bool ConfirmDifferentPersonOnSamePhone = false);

public record ConsentRequest(
    [Required, Range(typeof(bool), "true", "true", ErrorMessage = "Patient consent must be accepted")]
    bool Accepted,

    [StringLength(200, ErrorMessage = "Consent purpose cannot exceed 200 characters")]
    string Purpose);

public record PatientPatchRequest(
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Patient Name must be between 2 and 100 characters")]
    string? Name,

    [RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Phone number must be a valid 10-digit mobile number")]
    string? Phone,

    DateOnly? Dob,

    string? Gender,

    [StringLength(500, ErrorMessage = "Address cannot exceed 500 characters")]
    string? Address);

public record CheckDuplicateRequest(
    [Required(ErrorMessage = "Name is required"), StringLength(100, MinimumLength = 2)]
    string Name,

    [RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Phone number must be a valid 10-digit mobile number")]
    string? Phone,

    DateOnly? Dob);

public record BreakGlassRequest(
    [Required(ErrorMessage = "A reason code is required")]
    string ReasonCode,

    [StringLength(500)]
    string? Reason = null);

