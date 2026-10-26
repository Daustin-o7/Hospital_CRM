using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Constants;
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
    private readonly IModuleGateService _moduleGate;

    public AppointmentsController(
        HospitalCrmDbContext db,
        INotificationService notificationService,
        PrecheckService precheckService,
        ITimezoneService timezoneService,
        IModuleGateService moduleGate)
    {
        _db = db;
        _notificationService = notificationService;
        _precheckService = precheckService;
        _timezoneService = timezoneService;
        _moduleGate = moduleGate;
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
            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex) when (ex.IsUniqueViolation())
            {
                // Two receptionists booked the same slot: the DB index is the referee.
                return Conflict(new { error = "slot_already_booked" });
            }

            // FR-23-01: pre-check token generation inside the transaction,
            // committed atomically with the appointment via the single transaction.
            string? precheckPlaintext = null;
            if (await _moduleGate.IsModuleEnabledAsync(clinic.TenantId, ModuleRegistry.Precheck, ct))
            {
                var (plaintext, precheckSubmission) = await _precheckService.GenerateForAppointmentAsync(
                    appointment.Id, clinic.TenantId, ct);
                precheckPlaintext = plaintext;
                if (precheckSubmission is not null)
                {
                    _db.PrecheckSubmissions.Add(precheckSubmission);
                    await _db.SaveChangesAsync(ct);
                }
            }
            await transaction.CommitAsync(ct);

            // FR-20: notification fire-and-forget after commit. precheckPlaintext is captured
            // by value in the closure so the scoped DbContext can safely be disposed.
            // FR-20: WhatsApp confirmation (only with opt-in per DPDP Section 1)
            var bookedAppointment = appointment;
            var patient = await _db.Patients.Include(p => p.Consents).FirstOrDefaultAsync(p => p.Id == bookedAppointment.PatientId, ct);
            var clinicName = clinic.Name;
            var slotDateTime = bookedAppointment.Date.ToDateTime(TimeOnly.Parse(bookedAppointment.TimeSlot));
            var hasWhatsAppOptIn = patient?.Consents.Any(c => c.Purpose == "whatsapp_opt_in" && c.WithdrawnAt == null) ?? false;
            if (hasWhatsAppOptIn)
            {
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
            }

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
            await using var transaction = _db.Database.IsRelational() ? await _db.Database.BeginTransactionAsync(ct) : null;

            var appointment = await _db.Appointments.FindAsync([id], ct);
            if (appointment is null)
                return NotFound(new { error = "appointment_not_found" });

            // Idempotent: return already assigned tokens on double check-in
            if (appointment.QueueToken.HasValue)
            {
                return Ok(new
                {
                    status = formatStatus(appointment.Status),
                    queueToken = appointment.QueueToken,
                    trackingToken = appointment.QueueTrackingToken
                });
            }

            if (appointment.Status == AppointmentStatus.Completed ||
                appointment.Status == AppointmentStatus.Cancelled ||
                appointment.Status == AppointmentStatus.NoShow)
            {
                return BadRequest(new { error = "cannot_check_in_terminal_appointment" });
            }

            var clinic = await _db.Clinics.FindAsync([appointment.ClinicId], ct);
            var today = _timezoneService.GetClinicToday(clinic?.Timezone, HttpContext);

            int nextToken;
            if (_db.Database.IsRelational())
            {
                // Atomic counter per (tenant, doctor, date) via UPDATE RETURNING
                var counter = await _db.DoctorDailyQueueCounters
                    .FromSqlInterpolated($@"
                        INSERT INTO ""DoctorDailyQueueCounters"" (""Id"", ""TenantId"", ""DoctorId"", ""Date"", ""LastToken"", ""UpdatedAt"")
                        VALUES ({Guid.NewGuid()}, {appointment.TenantId}, {appointment.DoctorId}, {today}, 1, now())
                        ON CONFLICT (""TenantId"", ""DoctorId"", ""Date"")
                        DO UPDATE SET ""LastToken"" = ""DoctorDailyQueueCounters"".""LastToken"" + 1, ""UpdatedAt"" = now()
                        RETURNING *")
                    .AsNoTracking()
                    .FirstOrDefaultAsync(ct);
                nextToken = counter?.LastToken ?? 1;
            }
            else
            {
                var counter = await _db.DoctorDailyQueueCounters
                    .FirstOrDefaultAsync(c => c.TenantId == appointment.TenantId && c.DoctorId == appointment.DoctorId && c.Date == today, ct);
                if (counter is null)
                {
                    counter = new DoctorDailyQueueCounter
                    {
                        Id = Guid.NewGuid(),
                        TenantId = appointment.TenantId,
                        DoctorId = appointment.DoctorId,
                        Date = today,
                        LastToken = 1,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };
                    _db.DoctorDailyQueueCounters.Add(counter);
                }
                else
                {
                    counter.LastToken++;
                    counter.UpdatedAt = DateTimeOffset.UtcNow;
                }
                nextToken = counter.LastToken;
            }

            var trackingBytes = RandomNumberGenerator.GetBytes(16);
            var trackingToken = "qtrk_" + Convert.ToHexString(trackingBytes).ToLowerInvariant();

            appointment.Status = AppointmentStatus.CheckedIn;
            appointment.QueueToken = nextToken;
            appointment.QueueTrackingToken = trackingToken;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync(ct);
            if (transaction != null) await transaction.CommitAsync(ct);

            return Ok(new
            {
                status = "checked_in",
                queueToken = appointment.QueueToken,
                trackingToken = appointment.QueueTrackingToken
            });
        });
    }

    private static readonly Dictionary<AppointmentStatus, HashSet<AppointmentStatus>> AllowedTransitions = new()
    {
        [AppointmentStatus.Booked] = [AppointmentStatus.Confirmed, AppointmentStatus.CheckedIn, AppointmentStatus.Cancelled, AppointmentStatus.NoShow],
        [AppointmentStatus.Confirmed] = [AppointmentStatus.CheckedIn, AppointmentStatus.Cancelled, AppointmentStatus.NoShow],
        [AppointmentStatus.CheckedIn] = [AppointmentStatus.InNursing, AppointmentStatus.InConsultation, AppointmentStatus.Cancelled, AppointmentStatus.NoShow],
        [AppointmentStatus.InNursing] = [AppointmentStatus.InConsultation, AppointmentStatus.Completed, AppointmentStatus.Cancelled, AppointmentStatus.Parked],
        [AppointmentStatus.InConsultation] = [AppointmentStatus.Completed, AppointmentStatus.Parked, AppointmentStatus.Cancelled],
        [AppointmentStatus.Parked] = [AppointmentStatus.InConsultation, AppointmentStatus.Cancelled, AppointmentStatus.NoShow],
        [AppointmentStatus.Completed] = [], // Terminal
        [AppointmentStatus.Cancelled] = [], // Terminal
        [AppointmentStatus.NoShow] = []     // Terminal
    };

    [HttpPut("{id:guid}")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin", "Nurse")]
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

        // A nurse runs the nursing station (ready for doctor, back to queue), not completion.
        if (string.Equals(User.GetUserRole(), "Nurse", StringComparison.OrdinalIgnoreCase) &&
            newStatus is not (AppointmentStatus.InNursing or AppointmentStatus.InConsultation))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "insufficient_permissions" });
        }

        if (appointment.Status != newStatus.Value)
        {
            if (!AllowedTransitions.TryGetValue(appointment.Status, out var allowed) || !allowed.Contains(newStatus.Value))
            {
                return BadRequest(new
                {
                    error = "invalid_status_transition",
                    from = formatStatus(appointment.Status),
                    to = formatStatus(newStatus.Value),
                    message = $"Status transition from '{formatStatus(appointment.Status)}' to '{formatStatus(newStatus.Value)}' is not allowed."
                });
            }

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
            appointment.UpdatedAt = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync(ct);
        }

        return Ok(new { appointmentId = appointment.Id, status = formatStatus(appointment.Status) });
    }

    [HttpPost("{id:guid}/reschedule")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> Reschedule(Guid id, [FromBody] RescheduleAppointmentRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var appointment = await _db.Appointments.FindAsync([id], ct);
        if (appointment is null) return NotFound(new { error = "appointment_not_found" });

        if (appointment.Status == AppointmentStatus.Completed ||
            appointment.Status == AppointmentStatus.Cancelled)
        {
            return BadRequest(new { error = "cannot_reschedule_terminal_appointment" });
        }

        if (!DateOnly.TryParse(request.NewDate, out var newDate))
            return BadRequest(new { error = "invalid_date_format" });

        var slotTaken = await _db.Appointments.AnyAsync(a =>
            a.DoctorId == appointment.DoctorId &&
            a.Date == newDate &&
            a.TimeSlot == request.NewTimeSlot &&
            a.Id != appointment.Id &&
            a.Status != AppointmentStatus.Cancelled, ct);

        if (slotTaken)
            return Conflict(new { error = "slot_already_booked" });

        _db.AppointmentHistories.Add(new AppointmentHistory
        {
            Id = Guid.NewGuid(),
            AppointmentId = appointment.Id,
            PreviousDate = appointment.Date,
            PreviousTimeSlot = appointment.TimeSlot,
            PreviousStatus = appointment.Status,
            ChangedBy = userId.Value,
            ChangedAt = DateTimeOffset.UtcNow
        });

        appointment.Date = newDate;
        appointment.TimeSlot = request.NewTimeSlot;
        appointment.QueueToken = null;
        appointment.QueueTrackingToken = null;
        appointment.Status = AppointmentStatus.Booked;
        appointment.UpdatedAt = DateTimeOffset.UtcNow;

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            // Lost the race to another reschedule/booking for the same slot.
            return Conflict(new { error = "slot_already_booked" });
        }
        return Ok(new
        {
            appointmentId = appointment.Id,
            date = appointment.Date.ToString("yyyy-MM-dd"),
            timeSlot = appointment.TimeSlot,
            status = "booked"
        });
    }

    [HttpGet]
    [Authorize]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin", "Nurse")]
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
                patientUhid = a.Patient.Uhid,
                patientName = a.Patient.Name,
                patientPhone = a.Patient.Phone,
                patientGender = a.Patient.Gender.ToString(),
                patientDob = a.Patient.Dob,
                patientAge = a.Patient.ApproxAge,
                doctorId = a.DoctorId,
                doctorName = a.Doctor.Name,
                time = a.TimeSlot,
                status = formatStatus(a.Status),
                priority = a.Priority.ToString().ToLower(),
                queueToken = a.QueueToken,
                queueTrackingToken = a.QueueTrackingToken,
                triageReasonCode = a.TriageReasonCode,
                triageConfirmed = a.TriageConfirmedBy.HasValue,
                type = a.Type.ToString().ToLower()
            })
            .ToListAsync(ct);

        return Ok(list);
    }

    private static AppointmentStatus? parseStatus(string status)
    {
        return status.ToLowerInvariant().Replace("-", "_") switch
        {
            "booked" => AppointmentStatus.Booked,
            "confirmed" => AppointmentStatus.Confirmed,
            "checked_in" or "checkedin" => AppointmentStatus.CheckedIn,
            "in_nursing" or "innursing" => AppointmentStatus.InNursing,
            "in_consultation" or "inconsultation" => AppointmentStatus.InConsultation,
            "completed" => AppointmentStatus.Completed,
            "cancelled" => AppointmentStatus.Cancelled,
            "noshow" or "no_show" => AppointmentStatus.NoShow,
            "parked" => AppointmentStatus.Parked,
            _ => null
        };
    }

    private static string formatStatus(AppointmentStatus status) => status switch
    {
        AppointmentStatus.Booked => "booked",
        AppointmentStatus.Confirmed => "confirmed",
        AppointmentStatus.CheckedIn => "checked_in",
        AppointmentStatus.InNursing => "in_nursing",
        AppointmentStatus.InConsultation => "in_consultation",
        AppointmentStatus.Parked => "parked",
        AppointmentStatus.Completed => "completed",
        AppointmentStatus.Cancelled => "cancelled",
        AppointmentStatus.NoShow => "no_show",
        _ => status.ToString().ToLowerInvariant()
    };

    private static readonly HashSet<string> SevereTriageCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "chest_pain", "breathing_difficulty", "severe_trauma", "loss_of_consciousness", "severe_allergic_reaction"
    };

    private static readonly HashSet<string> ValidTriageCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "chest_pain", "breathing_difficulty", "severe_trauma", "loss_of_consciousness",
        "acute_abdomen", "high_fever_infant", "severe_allergic_reaction", "other_clinical_urgency"
    };

    [HttpPatch("{id:guid}/priority")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin", "Nurse")]
    public async Task<IActionResult> UpdatePriority(Guid id, [FromBody] UpdatePriorityRequest request, CancellationToken ct)
    {
        var appointment = await _db.Appointments.FindAsync([id], ct);
        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        if (!string.Equals(request.Priority, "emergency", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.Priority, "urgent", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.Priority, "normal", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "priority_must_be_emergency_urgent_or_normal" });

        var newPriority = string.Equals(request.Priority, "emergency", StringComparison.OrdinalIgnoreCase) ||
                          string.Equals(request.Priority, "urgent", StringComparison.OrdinalIgnoreCase)
            ? AppointmentPriority.Emergency
            : AppointmentPriority.Normal;

        var role = User.GetUserRole();
        var userId = User.GetUserId();

        // Front desk picks a structured clinical code. Free text was validation theater:
        // ten characters of anything used to pass as an emergency justification.
        if (newPriority == AppointmentPriority.Emergency &&
            string.Equals(role, nameof(UserRole.Receptionist), StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(request.TriageReasonCode))
        {
            return BadRequest(new { error = "triage_reason_code_required", validCodes = ValidTriageCodes });
        }

        if (!string.IsNullOrWhiteSpace(request.TriageReasonCode) && !ValidTriageCodes.Contains(request.TriageReasonCode))
        {
            return BadRequest(new { error = "invalid_triage_reason_code", validCodes = ValidTriageCodes });
        }

        appointment.Priority = newPriority;
        if (!string.IsNullOrWhiteSpace(request.TriageReasonCode))
        {
            appointment.TriageReasonCode = request.TriageReasonCode.ToLowerInvariant();
        }

        if (string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Nurse", StringComparison.OrdinalIgnoreCase) ||
            request.ConfirmTriage)
        {
            appointment.TriageConfirmedBy = userId;
            appointment.TriageConfirmedAt = DateTimeOffset.UtcNow;
        }

        _db.PriorityLogs.Add(new PriorityLog
        {
            Id = Guid.NewGuid(),
            AppointmentId = id,
            ChangedBy = userId!.Value,
            ChangedTo = newPriority.ToString().ToLower(),
            Reason = request.Reason?.Trim() ?? request.TriageReasonCode,
            ChangedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        string? referralWarning = null;
        if (appointment.TriageReasonCode != null && SevereTriageCodes.Contains(appointment.TriageReasonCode))
        {
            referralWarning = "Critical emergency condition suspected. Immediate hospital ER referral recommended.";
        }

        return Ok(new
        {
            appointmentId = id,
            priority = newPriority.ToString().ToLower(),
            triageReasonCode = appointment.TriageReasonCode,
            triageConfirmed = appointment.TriageConfirmedBy.HasValue,
            hospitalReferralAdvisory = referralWarning,
            unchanged = false
        });
    }

    /// <summary>FR-23-03 — Doctor reviews pre-check submission inline in consult flow.</summary>
    [HttpGet("{id:guid}/precheck")]
    [AuthorizeRoles("Doctor", "ClinicAdmin")]
    [RequireModule(ModuleRegistry.Precheck)]
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
            .IgnoreQueryFilters()
            .Include(s => s.Appointment)
                .ThenInclude(a => a.Patient)
            .FirstOrDefaultAsync(s => s.TokenHash == hash, ct);

        if (submission is null)
            return BadRequest(new { error = "invalid_token" });

        if (!await _moduleGate.IsModuleEnabledAsync(submission.TenantId, ModuleRegistry.Precheck, ct))
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = "module_not_activated", module = ModuleRegistry.Precheck });

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

    /// <summary>FR-23-02 - Validate a pre-check link without submitting (unauthenticated, same tokenisation).</summary>
    [HttpGet("/api/v1/precheck/{token}")]
    [AllowAnonymous]
    [EnableRateLimiting("precheck")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GetPrecheckStatus(string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { error = "invalid_token" });

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
        var submission = await _db.PrecheckSubmissions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.TokenHash == hash, ct);

        if (submission is null)
            return BadRequest(new { error = "invalid_token" });

        if (!await _moduleGate.IsModuleEnabledAsync(submission.TenantId, ModuleRegistry.Precheck, ct))
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = "module_not_activated", module = ModuleRegistry.Precheck });

        if (submission.SubmittedAt is not null)
            return Ok(new { message = "already_submitted" });

        if (DateTimeOffset.UtcNow > submission.ExpiresAt)
            return BadRequest(new { error = "token_expired" });

        return Ok(new { message = "valid" });
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

public record RescheduleAppointmentRequest(
    [Required(ErrorMessage = "New appointment date is required"), RegularExpression(@"^\d{4}-\d{2}-\d{2}$", ErrorMessage = "Date must be YYYY-MM-DD")]
    string NewDate,

    [Required(ErrorMessage = "New time slot is required"), RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$", ErrorMessage = "TimeSlot must be HH:mm format")]
    string NewTimeSlot);

public record UpdatePriorityRequest(
    [Required(ErrorMessage = "Priority is required"), RegularExpression("(?i)^(normal|emergency|urgent)$", ErrorMessage = "Priority must be normal, urgent, or emergency")]
    string Priority,

    [StringLength(300, ErrorMessage = "Reason cannot exceed 300 characters")]
    string? Reason = null,

    string? TriageReasonCode = null,

    bool ConfirmTriage = false);

