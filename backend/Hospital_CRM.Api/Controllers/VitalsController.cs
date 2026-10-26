using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

public record RecordVitalsRequest(
    int? SystolicBp,
    int? DiastolicBp,
    int? HeartRate,
    decimal? Temperature,
    int? RespiratoryRate,
    int? SpO2,
    decimal? WeightKg,
    decimal? HeightCm,
    decimal? BloodGlucoseMgDl,
    string? Allergies,
    string? BedsideObservations);

/// <summary>
/// Core Section 2: Clinical Triage & Vitals capture.
/// Available to Nurse, Doctor, ClinicAdmin, and Receptionist with ZERO module dependency.
/// Directly feeds Section 3 Consultations and transitions appointments to InNursing.
/// </summary>
[ApiController]
[Route("api/v1")]
public class VitalsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<VitalsController> _logger;

    public VitalsController(HospitalCrmDbContext db, ILogger<VitalsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpPost("appointments/{appointmentId:guid}/vitals")]
    [AuthorizeRoles("Nurse", "Doctor", "ClinicAdmin", "Receptionist")]
    [RequirePermission(Permissions.VitalsWrite)]
    public async Task<IActionResult> RecordVitals(
        Guid appointmentId,
        [FromBody] RecordVitalsRequest request,
        CancellationToken ct)
    {
        var callerId = User.GetUserId();
        if (!callerId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var tenantId = User.GetTenantId();

        var appointment = await _db.Appointments
            .Include(a => a.Patient)
            .FirstOrDefaultAsync(a => a.Id == appointmentId &&
                (!tenantId.HasValue || a.TenantId == tenantId.Value), ct);

        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        // A closed encounter is a clinical record; vitals cannot rewrite it after the fact.
        if (appointment.Status is AppointmentStatus.Completed or AppointmentStatus.Cancelled or AppointmentStatus.NoShow)
            return Conflict(new { error = "appointment_closed", status = appointment.Status.ToString() });

        decimal? calculatedBmi = null;
        if (request.WeightKg.HasValue && request.HeightCm.HasValue && request.HeightCm.Value > 0)
        {
            var heightM = request.HeightCm.Value / 100m;
            calculatedBmi = Math.Round(request.WeightKg.Value / (heightM * heightM), 1);
        }

        var existing = await _db.PatientVitals
            .FirstOrDefaultAsync(v => v.AppointmentId == appointmentId, ct);

        if (existing is null)
        {
            existing = new PatientVital
            {
                Id = Guid.NewGuid(),
                TenantId = appointment.TenantId,
                AppointmentId = appointmentId,
                PatientId = appointment.PatientId,
                SystolicBp = request.SystolicBp,
                DiastolicBp = request.DiastolicBp,
                HeartRate = request.HeartRate,
                Temperature = request.Temperature,
                RespiratoryRate = request.RespiratoryRate,
                SpO2 = request.SpO2,
                WeightKg = request.WeightKg,
                HeightCm = request.HeightCm,
                Bmi = calculatedBmi,
                BloodGlucoseMgDl = request.BloodGlucoseMgDl,
                Allergies = request.Allergies,
                BedsideObservations = request.BedsideObservations,
                RecordedByUserId = callerId.Value,
                RecordedAt = DateTimeOffset.UtcNow
            };
            _db.PatientVitals.Add(existing);
        }
        else
        {
            existing.SystolicBp = request.SystolicBp;
            existing.DiastolicBp = request.DiastolicBp;
            existing.HeartRate = request.HeartRate;
            existing.Temperature = request.Temperature;
            existing.RespiratoryRate = request.RespiratoryRate;
            existing.SpO2 = request.SpO2;
            existing.WeightKg = request.WeightKg;
            existing.HeightCm = request.HeightCm;
            existing.Bmi = calculatedBmi;
            existing.BloodGlucoseMgDl = request.BloodGlucoseMgDl;
            existing.Allergies = request.Allergies;
            existing.BedsideObservations = request.BedsideObservations;
            existing.RecordedByUserId = callerId.Value;
            existing.RecordedAt = DateTimeOffset.UtcNow;
        }

        // Automatic state transition: when vitals are captured for CheckedIn patient, move to InNursing
        if (appointment.Status == AppointmentStatus.CheckedIn)
        {
            appointment.Status = AppointmentStatus.InNursing;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;
        }

        // Who captured which vitals, and for which encounter — append-only patient audit.
        _db.PatientAuditLogs.Add(new PatientAuditLog
        {
            Id = Guid.NewGuid(),
            PatientId = appointment.PatientId,
            FieldName = "VITALS_RECORDED",
            OldValue = string.Empty,
            NewValue = $"Appointment {appointmentId} / {appointment.Status}",
            ChangedBy = callerId.Value,
            ChangedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Vitals recorded for appointment {AppointmentId} by user {UserId}",
            appointmentId, callerId.Value);

        return Ok(new
        {
            id = existing.Id,
            appointmentId = existing.AppointmentId,
            patientId = existing.PatientId,
            systolicBp = existing.SystolicBp,
            diastolicBp = existing.DiastolicBp,
            heartRate = existing.HeartRate,
            temperature = existing.Temperature,
            respiratoryRate = existing.RespiratoryRate,
            spO2 = existing.SpO2,
            weightKg = existing.WeightKg,
            heightCm = existing.HeightCm,
            bmi = existing.Bmi,
            bloodGlucoseMgDl = existing.BloodGlucoseMgDl,
            allergies = existing.Allergies,
            bedsideObservations = existing.BedsideObservations,
            recordedAt = existing.RecordedAt,
            appointmentStatus = appointment.Status.ToString()
        });
    }

    [HttpGet("appointments/{appointmentId:guid}/vitals")]
    [AuthorizeRoles("Nurse", "Doctor", "ClinicAdmin", "Receptionist")]
    [RequirePermission(Permissions.PatientsRead)]
    public async Task<IActionResult> GetAppointmentVitals(Guid appointmentId, CancellationToken ct)
    {
        var tenantId = User.GetTenantId();
        var vitals = await _db.PatientVitals
            .AsNoTracking()
            .Include(v => v.RecordedByUser)
            .Where(v => v.AppointmentId == appointmentId &&
                (!tenantId.HasValue || v.TenantId == tenantId.Value))
            .Select(v => new
            {
                id = v.Id,
                appointmentId = v.AppointmentId,
                patientId = v.PatientId,
                systolicBp = v.SystolicBp,
                diastolicBp = v.DiastolicBp,
                heartRate = v.HeartRate,
                temperature = v.Temperature,
                respiratoryRate = v.RespiratoryRate,
                spO2 = v.SpO2,
                weightKg = v.WeightKg,
                heightCm = v.HeightCm,
                bmi = v.Bmi,
                bloodGlucoseMgDl = v.BloodGlucoseMgDl,
                allergies = v.Allergies,
                bedsideObservations = v.BedsideObservations,
                recordedBy = v.RecordedByUser != null ? v.RecordedByUser.Name : null,
                recordedAt = v.RecordedAt
            })
            .FirstOrDefaultAsync(ct);

        if (vitals is null)
            return NotFound(new { error = "vitals_not_recorded" });

        return Ok(vitals);
    }

    [HttpGet("patients/{patientId:guid}/vitals/latest")]
    [AuthorizeRoles("Nurse", "Doctor", "ClinicAdmin")]
    [RequirePermission(Permissions.PatientsRead)]
    public async Task<IActionResult> GetLatestPatientVitals(Guid patientId, CancellationToken ct)
    {
        var tenantId = User.GetTenantId();
        var vitals = await _db.PatientVitals
            .AsNoTracking()
            .Include(v => v.RecordedByUser)
            .Where(v => v.PatientId == patientId &&
                (!tenantId.HasValue || v.TenantId == tenantId.Value))
            .OrderByDescending(v => v.RecordedAt)
            .Select(v => new
            {
                id = v.Id,
                appointmentId = v.AppointmentId,
                patientId = v.PatientId,
                systolicBp = v.SystolicBp,
                diastolicBp = v.DiastolicBp,
                heartRate = v.HeartRate,
                temperature = v.Temperature,
                respiratoryRate = v.RespiratoryRate,
                spO2 = v.SpO2,
                weightKg = v.WeightKg,
                heightCm = v.HeightCm,
                bmi = v.Bmi,
                bloodGlucoseMgDl = v.BloodGlucoseMgDl,
                allergies = v.Allergies,
                bedsideObservations = v.BedsideObservations,
                recordedBy = v.RecordedByUser != null ? v.RecordedByUser.Name : null,
                recordedAt = v.RecordedAt
            })
            .FirstOrDefaultAsync(ct);

        if (vitals is null)
            return NotFound(new { error = "no_vitals_found" });

        return Ok(vitals);
    }
}
