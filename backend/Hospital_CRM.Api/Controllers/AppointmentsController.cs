using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AppointmentsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly INotificationService _notificationService;
    private readonly PrecheckService _precheckService;
    private readonly ITimezoneService _timezoneService;

    public AppointmentsController(
        HospitalCrmDbContext db,
        INotificationService notificationService,
        PrecheckService precheckService,
        ITimezoneService timezoneService)
    {
        _db = db;
        _notificationService = notificationService;
        _precheckService = precheckService;
        _timezoneService = timezoneService;
    }

    [HttpPost]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> Book([FromBody] BookAppointmentRequest request, CancellationToken ct)
    {
        if (!DateOnly.TryParse(request.Date, out var appointmentDate))
            return BadRequest(new { error = "invalid_date_format" });

        var patient = await _db.Patients.FindAsync([request.PatientId], ct);
        if (patient is null)
            return NotFound(new { error = "patient_not_found" });

        var doctor = await _db.Users.FirstOrDefaultAsync(u => u.Id == request.DoctorId && u.Role == UserRole.Doctor, ct);
        if (doctor is null)
            return NotFound(new { error = "doctor_not_found" });

        var clinic = await _db.Clinics
            .Include(c => c.WorkingHours)
            .Include(c => c.Holidays)
            .Include(c => c.SpecialHours)
            .FirstOrDefaultAsync(c => c.Id == doctor.ClinicId, ct);

        if (clinic is null)
        {
            clinic = await _db.Clinics
                .Include(c => c.WorkingHours)
                .Include(c => c.Holidays)
                .Include(c => c.SpecialHours)
                .FirstOrDefaultAsync(ct);
        }

        if (clinic is null)
            return BadRequest(new { error = "no_clinic_configured" });

        // Check if the requested date falls within a holiday range (exact date or recurring annually MM-dd)
        var requestDate = appointmentDate.ToString("yyyy-MM-dd");
        var requestMonthDay = appointmentDate.ToString("MM-dd");
        var isHoliday = clinic.Holidays.Any(h =>
        {
            if (h.RecurringAnnually && h.StartDate.Length >= 10 && h.EndDate.Length >= 10)
            {
                var startMd = h.StartDate.Substring(5, 5);
                var endMd = h.EndDate.Substring(5, 5);
                return string.Compare(requestMonthDay, startMd, StringComparison.Ordinal) >= 0 &&
                       string.Compare(requestMonthDay, endMd, StringComparison.Ordinal) <= 0;
            }

            return string.Compare(requestDate, h.StartDate, StringComparison.Ordinal) >= 0 &&
                   string.Compare(requestDate, h.EndDate, StringComparison.Ordinal) <= 0;
        });

        if (isHoliday)
            return BadRequest(new { error = "clinic_closed_on_selected_date" });

        var dayOfWeek = (int)appointmentDate.DayOfWeek;

        // Check if there's a special opening hour override for this date
        var specialHour = clinic.SpecialHours.FirstOrDefault(s => s.Date == requestDate);
        if (specialHour is not null)
        {
            // Special hours override normal schedule
            if (string.CompareOrdinal(request.TimeSlot, specialHour.OpenTime) < 0 ||
                string.CompareOrdinal(request.TimeSlot, specialHour.CloseTime) >= 0)
            {
                return BadRequest(new { error = "time_slot_outside_special_working_hours" });
            }
        }
        else
        {
            // Use the normal weekly schedule if configured
            if (clinic.WorkingHours.Any())
            {
                var workingShifts = clinic.WorkingHours
                    .Where(h => h.DayOfWeek == dayOfWeek)
                    .OrderBy(h => h.ShiftIndex)
                    .ToList();

                if (workingShifts.Count == 0)
                    return BadRequest(new { error = "clinic_closed_on_selected_day" });

                // Verify the time slot falls within at least one of the shifts
                var isInAnyShift = workingShifts.Any(s =>
                    string.CompareOrdinal(request.TimeSlot, s.OpenTime) >= 0 &&
                    string.CompareOrdinal(request.TimeSlot, s.CloseTime) < 0);

                if (!isInAnyShift)
                    return BadRequest(new { error = "time_slot_outside_working_hours" });
            }
            else
            {
                // Fallback default working hours (08:00 to 20:00) when not explicitly configured
                if (string.CompareOrdinal(request.TimeSlot, "08:00") < 0 ||
                    string.CompareOrdinal(request.TimeSlot, "20:00") >= 0)
                {
                    return BadRequest(new { error = "time_slot_outside_working_hours" });
                }
            }
        }

        var executionStrategy = _db.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(ct);
            var slotTaken = await _db.Appointments.AnyAsync(a =>
                a.DoctorId == request.DoctorId &&
                a.Date == appointmentDate &&
                a.TimeSlot == request.TimeSlot &&
                a.Status != AppointmentStatus.Cancelled, ct);

            if (slotTaken)
                return Conflict(new { error = "slot_already_booked" });

            var typeEnum = string.Equals(request.Type, "walkin", StringComparison.OrdinalIgnoreCase)
                ? AppointmentType.WalkIn
                : AppointmentType.Scheduled;

            var appointment = new Appointment
            {
                Id = Guid.NewGuid(),
                TenantId = clinic.TenantId,
                PatientId = request.PatientId,
                DoctorId = request.DoctorId,
                ClinicId = clinic.Id,
                Date = appointmentDate,
                TimeSlot = request.TimeSlot,
                Type = typeEnum,
                Status = AppointmentStatus.Booked,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _db.Appointments.Add(appointment);

            // Save appointment first so PrecheckService can query it (it checks type and lead time)
            await _db.SaveChangesAsync(ct);

            // FR-23-01: pre-check token generation inside the transaction,
            // committed atomically with the appointment via the single transaction.
            string? precheckPlaintext = null;
            var (plaintext, precheckSubmission) = await _precheckService.GenerateForAppointmentAsync(
                appointment.Id, clinic.TenantId, ct);
            precheckPlaintext = plaintext;
            if (precheckSubmission is not null)
            {
                _db.PrecheckSubmissions.Add(precheckSubmission);
                await _db.SaveChangesAsync(ct);
            }
            await transaction.CommitAsync(ct);

            // FR-20: notification fire-and-forget after commit. precheckPlaintext is captured
            // by value in the closure so the scoped DbContext can safely be disposed.
            var bookedAppointment = appointment;
            var patient = await _db.Patients.FindAsync([bookedAppointment.PatientId], ct);
            var clinicName = clinic.Name;
            var slotDateTime = bookedAppointment.Date.ToDateTime(TimeOnly.Parse(bookedAppointment.TimeSlot));
            _ = Task.Run(async () =>
            {
                try
                {
                    var link = precheckPlaintext is null ? null : _precheckService.BuildLink(precheckPlaintext);
                    if (patient != null)
                    {
                        await _notificationService.SendAppointmentConfirmationAsync(
                            bookedAppointment.Id, patient.Phone, clinicName, slotDateTime, link);
                    }
                }
                catch { /* logged inside the service */ }
            });

            return StatusCode(201, new
            {
                appointmentId = appointment.Id,
                status = "booked",
                queueToken = (int?)null
            });
        });
    }

    [HttpPost("{id:guid}/check-in")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> CheckIn(Guid id, CancellationToken ct)
    {
        var executionStrategy = _db.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(ct);

            var appointment = await _db.Appointments.FindAsync([id], ct);
            if (appointment is null)
                return NotFound(new { error = "appointment_not_found" });

            if (appointment.Status == AppointmentStatus.CheckedIn)
                return Ok(new { status = "checked_in", queueToken = appointment.QueueToken });

            if (appointment.Status == AppointmentStatus.Completed || appointment.Status == AppointmentStatus.Cancelled)
                return BadRequest(new { error = "cannot_check_in_completed_or_cancelled_appointment" });

            var clinic = await _db.Clinics.FindAsync([appointment.ClinicId], ct);
            var today = _timezoneService.GetClinicToday(clinic?.Timezone, HttpContext);
            var maxToken = await _db.Appointments
                .Where(a => a.ClinicId == appointment.ClinicId && a.Date == today && a.QueueToken.HasValue)
                .MaxAsync(a => (int?)a.QueueToken, ct) ?? 0;

            appointment.Status = AppointmentStatus.CheckedIn;
            appointment.QueueToken = maxToken + 1;

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Ok(new { status = "checked_in", queueToken = appointment.QueueToken });
        });
    }

    [HttpPut("{id:guid}")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAppointmentRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var appointment = await _db.Appointments.FindAsync([id], ct);
        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        var newStatus = parseStatus(request.Status);
        if (newStatus is null)
            return BadRequest(new { error = "invalid_status" });

        var history = new AppointmentHistory
        {
            Id = Guid.NewGuid(),
            AppointmentId = appointment.Id,
            PreviousDate = appointment.Date,
            PreviousTimeSlot = appointment.TimeSlot,
            PreviousStatus = appointment.Status,
            ChangedBy = userId.Value,
            ChangedAt = DateTimeOffset.UtcNow
        };

        _db.AppointmentHistories.Add(history);
        appointment.Status = newStatus.Value;

        await _db.SaveChangesAsync(ct);
        return Ok(new { appointmentId = appointment.Id, status = appointment.Status.ToString().ToLower() });
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> List([FromQuery] string? date, [FromQuery] Guid? doctorId, CancellationToken ct)
    {
        var query = _db.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor)
            .AsQueryable();

        if (DateOnly.TryParse(date, out var parsedDate))
            query = query.Where(a => a.Date == parsedDate);

        if (doctorId.HasValue)
            query = query.Where(a => a.DoctorId == doctorId.Value);

        var list = await query
            .OrderByDescending(a => a.Priority) // emergency (1) before normal (0)
            .ThenBy(a => a.Date)
            .ThenBy(a => a.TimeSlot)
            .Select(a => new
            {
                appointmentId = a.Id,
                patientId = a.PatientId,
                patientName = a.Patient.Name,
                patientPhone = a.Patient.Phone,
                patientGender = a.Patient.Gender.ToString(),
                patientDob = a.Patient.Dob,
                patientAge = a.Patient.ApproxAge,
                doctorId = a.DoctorId,
                doctorName = a.Doctor.Name,
                time = a.TimeSlot,
                status = a.Status.ToString().ToLower(),
                priority = a.Priority.ToString().ToLower(),
                queueToken = a.QueueToken,
                type = a.Type.ToString().ToLower()
            })
            .ToListAsync(ct);

        return Ok(list);
    }

    private static AppointmentStatus? parseStatus(string status)
    {
        return status.ToLower() switch
        {
            "booked" => AppointmentStatus.Booked,
            "checked_in" or "checkedin" => AppointmentStatus.CheckedIn,
            "completed" => AppointmentStatus.Completed,
            "cancelled" => AppointmentStatus.Cancelled,
            "noshow" => AppointmentStatus.NoShow,
            _ => null
        };
    }

    [HttpPatch("{id:guid}/priority")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> UpdatePriority(Guid id, [FromBody] UpdatePriorityRequest request, CancellationToken ct)
    {
        var appointment = await _db.Appointments.FindAsync([id], ct);
        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        if (!string.Equals(request.Priority, "emergency", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.Priority, "normal", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "priority_must_be_emergency_or_normal" });

        var newPriority = string.Equals(request.Priority, "emergency", StringComparison.OrdinalIgnoreCase)
            ? AppointmentPriority.Emergency
            : AppointmentPriority.Normal;

        var role = User.GetUserRole();
        // P2-C3: Receptionist must provide an operational reason (>= 10 chars) when flagging emergency
        if (newPriority == AppointmentPriority.Emergency &&
            string.Equals(role, nameof(UserRole.Receptionist), StringComparison.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 10)
            {
                return BadRequest(new { error = "emergency_reason_required_min_10_chars" });
            }
        }

        if (appointment.Priority == newPriority)
            return Ok(new { appointmentId = id, priority = newPriority.ToString().ToLower(), unchanged = true });

        var userId = User.GetUserId();
        appointment.Priority = newPriority;

        _db.PriorityLogs.Add(new PriorityLog
        {
            Id = Guid.NewGuid(),
            AppointmentId = id,
            ChangedBy = userId!.Value,
            ChangedTo = newPriority.ToString().ToLower(),
            Reason = request.Reason?.Trim(),
            ChangedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return Ok(new { appointmentId = id, priority = newPriority.ToString().ToLower(), unchanged = false });
    }

    /// <summary>FR-23-03 — Doctor reviews pre-check submission inline in consult flow.</summary>
    [HttpGet("{id:guid}/precheck")]
    [AuthorizeRoles("Doctor", "ClinicAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrecheckSubmission(Guid id, CancellationToken ct)
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

    /// <summary>FR-23-02 — Patient submits pre-check form (unauthenticated, tokenized with DOB verification).</summary>
    [HttpPost("/api/v1/precheck/{token}")]
    [AllowAnonymous]
    [EnableRateLimiting("precheck")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> SubmitPrecheck(string token, [FromBody] PrecheckSubmissionRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { error = "invalid_token" });

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
        var submission = await _db.PrecheckSubmissions
            .Include(s => s.Appointment)
                .ThenInclude(a => a.Patient)
            .FirstOrDefaultAsync(s => s.TokenHash == hash, ct);

        if (submission is null)
            return BadRequest(new { error = "invalid_token" });

        if (submission.SubmittedAt is not null)
            return Ok(new { message = "already_submitted" });

        if (DateTimeOffset.UtcNow > submission.ExpiresAt)
            return BadRequest(new { error = "token_expired" });

        // P2-C1 Identity binding: Verify submitted DOB matches patient record
        var patient = submission.Appointment?.Patient;
        if (patient != null && patient.DobHasValue && patient.Dob.HasValue)
        {
            if (string.IsNullOrWhiteSpace(request.DateOfBirth) ||
                !DateOnly.TryParse(request.DateOfBirth, out var submittedDob) ||
                submittedDob != patient.Dob.Value)
            {
                return BadRequest(new { error = "identity_verification_failed" });
            }
        }

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
    string? DateOfBirth,
    string? ChiefComplaint,
    string? SymptomDuration,
    string? Medications,
    string? Allergies
);

public record BookAppointmentRequest(
    [Required(ErrorMessage = "Patient ID is required")]
    Guid PatientId,

    [Required(ErrorMessage = "Doctor ID is required")]
    Guid DoctorId,

    [Required(ErrorMessage = "Appointment Date is required"), RegularExpression(@"^\d{4}-\d{2}-\d{2}$", ErrorMessage = "Date must be YYYY-MM-DD")]
    string Date,

    [Required(ErrorMessage = "TimeSlot is required"), RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$", ErrorMessage = "TimeSlot must be HH:mm format")]
    string TimeSlot,

    [Required(ErrorMessage = "Appointment Type is required")]
    string Type);

public record UpdateAppointmentRequest(
    [Required(ErrorMessage = "Status is required")]
    string Status);

public record UpdatePriorityRequest(
    [Required(ErrorMessage = "Priority is required"), RegularExpression("(?i)^(normal|emergency|urgent)$", ErrorMessage = "Priority must be normal, urgent, or emergency")]
    string Priority,

    [StringLength(300, ErrorMessage = "Reason cannot exceed 300 characters")]
    string? Reason = null);

