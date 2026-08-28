using System.Security.Claims;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
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
        var appointment = await _db.Appointments.FindAsync([appointmentId], ct);
        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        if (appointment.Status != AppointmentStatus.CheckedIn)
            return BadRequest(new { error = "appointment_not_checked_in" });

        var doctorId = Guid.Parse(User.FindFirst("sub")!.Value);

        var consultation = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = appointmentId,
            DoctorId = doctorId,
            ChiefComplaint = request.ChiefComplaint,
            Observations = request.Observations,
            Diagnosis = request.Diagnosis,
            Version = 1,
            PreviousVersionId = null,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Consultations.Add(consultation);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new { consultationId = consultation.Id, version = 1 });
    }

    [HttpPatch("consultations/{id:guid}")]
    [AuthorizeRoles("Doctor")]
    public async Task<IActionResult> AmendConsultation(Guid id, [FromBody] AmendConsultationRequest request, CancellationToken ct)
    {
        var original = await _db.Consultations.FindAsync([id], ct);
        if (original is null)
            return NotFound(new { error = "consultation_not_found" });

        var doctorId = Guid.Parse(User.FindFirst("sub")!.Value);

        // Verify same clinic (doctor must belong to same clinic as original author)
        var author = await _db.Users.FindAsync([original.DoctorId], ct);
        var amendee = await _db.Users.FindAsync([doctorId], ct);
        if (author?.ClinicId != amendee?.ClinicId)
            return Forbid();

        var amended = new Consultation
        {
            Id = Guid.NewGuid(),
            AppointmentId = original.AppointmentId,
            DoctorId = doctorId,
            ChiefComplaint = request.Amendment,
            Observations = original.Observations,
            Diagnosis = original.Diagnosis,
            Version = original.Version + 1,
            PreviousVersionId = original.Id,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Consultations.Add(amended);
        await _db.SaveChangesAsync(ct);

        return Ok(new { consultationId = amended.Id, version = amended.Version });
    }

    [HttpPost("consultations/{id:guid}/prescription")]
    [AuthorizeRoles("Doctor")]
    public async Task<IActionResult> WritePrescription(Guid id, [FromBody] WritePrescriptionRequest request, CancellationToken ct)
    {
        var consultation = await _db.Consultations.FindAsync([id], ct);
        if (consultation is null)
            return NotFound(new { error = "consultation_not_found" });

        var prescription = new Prescription
        {
            Id = Guid.NewGuid(),
            ConsultationId = id,
            CreatedAt = DateTimeOffset.UtcNow
        };

        foreach (var item in request.Items)
        {
            prescription.Items.Add(new PrescriptionItem
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

        return StatusCode(201, new { prescriptionId = prescription.Id, consultationId = consultation.Id });
    }

    [HttpGet("patients/{patientId:guid}/history")]
    [AuthorizeRoles("Doctor", "ClinicAdmin")]
    public async Task<IActionResult> GetTreatmentHistory(Guid patientId, CancellationToken ct)
    {
        var consultations = await _db.Consultations
            .Where(c => c.Appointment.PatientId == patientId)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                consultationId = c.Id,
                date = c.CreatedAt,
                doctorName = c.Doctor.Name,
                chiefComplaint = c.ChiefComplaint,
                diagnosis = c.Diagnosis,
                version = c.Version,
                prescriptions = c.Prescriptions.Select(p => new
                {
                    prescriptionId = p.Id,
                    items = p.Items.Select(pi => new
                    {
                        medicine = pi.MedicineText,
                        dosage = pi.DosageText,
                        frequency = pi.FrequencyText,
                        duration = pi.DurationText
                    })
                })
            })
            .ToListAsync(ct);

        return Ok(consultations);
    }
}

public record CreateConsultationRequest(
    string? ChiefComplaint,
    string? Observations,
    string? Diagnosis);

public record AmendConsultationRequest(
    string Amendment,
    string? Reason);

public record WritePrescriptionRequest(
    List<PrescriptionItemRequest> Items);

public record PrescriptionItemRequest(
    string Medicine,
    string Dosage,
    string Frequency,
    string Duration);
