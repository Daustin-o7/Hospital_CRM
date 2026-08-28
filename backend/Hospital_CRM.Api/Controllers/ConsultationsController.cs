using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class ConsultationsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public ConsultationsController(HospitalCrmDbContext db)
    {
        _db = db;
    }

    [HttpPost("appointments/{appointmentId:guid}/consultation")]
    [AuthorizeRoles("Doctor")]
    public async Task<IActionResult> CreateConsultation(Guid appointmentId, [FromBody] CreateConsultationRequest request, CancellationToken ct)
    {
        var doctorId = User.GetUserId();
        if (!doctorId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var appointment = await _db.Appointments.FindAsync([appointmentId], ct);
        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        if (appointment.DoctorId != doctorId.Value)
            return Forbid();

        var version = 1;
        if (request.PreviousVersionId.HasValue)
        {
            var prev = await _db.Consultations.FindAsync([request.PreviousVersionId.Value], ct);
            if (prev is null)
                return BadRequest(new { error = "previous_version_not_found" });
            version = prev.Version + 1;
        }

        var consultation = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = appointmentId,
            DoctorId = doctorId.Value,
            ChiefComplaint = request.ChiefComplaint,
            Observations = request.Observations,
            Diagnosis = request.Diagnosis,
            Version = version,
            PreviousVersionId = request.PreviousVersionId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Consultations.Add(consultation);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            consultationId = consultation.Id,
            version = consultation.Version,
            createdAt = consultation.CreatedAt
        });
    }

    [HttpPost("consultations/{consultationId:guid}/amend")]
    [AuthorizeRoles("Doctor")]
    public async Task<IActionResult> AmendConsultation(Guid consultationId, [FromBody] CreateConsultationRequest request, CancellationToken ct)
    {
        var doctorId = User.GetUserId();
        if (!doctorId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var existing = await _db.Consultations.FindAsync([consultationId], ct);
        if (existing is null)
            return NotFound(new { error = "consultation_not_found" });

        var authorUser = await _db.Users.FindAsync([existing.DoctorId], ct);
        var currentUser = await _db.Users.FindAsync([doctorId.Value], ct);

        if (authorUser is null || currentUser is null)
            return Forbid();

        if (authorUser.ClinicId is null || currentUser.ClinicId is null || authorUser.ClinicId != currentUser.ClinicId)
            return Forbid();

        var newVersion = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = existing.AppointmentId,
            DoctorId = doctorId.Value,
            ChiefComplaint = request.ChiefComplaint ?? existing.ChiefComplaint,
            Observations = request.Observations ?? existing.Observations,
            Diagnosis = request.Diagnosis ?? existing.Diagnosis,
            Version = existing.Version + 1,
            PreviousVersionId = existing.Id,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Consultations.Add(newVersion);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            consultationId = newVersion.Id,
            version = newVersion.Version,
            createdAt = newVersion.CreatedAt
        });
    }

    [HttpPost("consultations/{consultationId:guid}/prescriptions")]
    [AuthorizeRoles("Doctor")]
    public async Task<IActionResult> AddPrescription(Guid consultationId, [FromBody] AddPrescriptionRequest request, CancellationToken ct)
    {
        var consultation = await _db.Consultations.FindAsync([consultationId], ct);
        if (consultation is null)
            return NotFound(new { error = "consultation_not_found" });

        var prescription = new Prescription
        {
            Id = Guid.NewGuid(),
            ConsultationId = consultationId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        foreach (var item in request.Items)
        {
            _db.PrescriptionItems.Add(new PrescriptionItem
            {
                Id = Guid.NewGuid(),
                PrescriptionId = prescription.Id,
                MedicineText = item.Medicine,
                DosageText = item.Dosage,
                FrequencyText = item.Frequency,
                DurationText = item.Duration
            });
        }

        _db.Prescriptions.Add(prescription);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new { prescriptionId = prescription.Id });
    }
}

public record CreateConsultationRequest(string? ChiefComplaint, string? Observations, string? Diagnosis, Guid? PreviousVersionId);
public record AddPrescriptionRequest(List<PrescriptionItemRequest> Items);
public record PrescriptionItemRequest(string Medicine, string Dosage, string Frequency, string Duration);
