using System.Security.Claims;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AppointmentsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly INotificationService _notificationService;

    public AppointmentsController(HospitalCrmDbContext db, INotificationService notificationService)
    {
        _db = db;
        _notificationService = notificationService;
    }

    [HttpPost]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> Book([FromBody] BookAppointmentRequest request, CancellationToken ct)
    {
        var patient = await _db.Patients.FindAsync([request.PatientId], ct);
        if (patient is null)
            return NotFound(new { error = "patient_not_found" });

        var doctor = await _db.Users.FindAsync([request.DoctorId], ct);
        if (doctor is null)
            return NotFound(new { error = "doctor_not_found" });

        if (!DateOnly.TryParse(request.Date, out var date))
            return BadRequest(new { error = "invalid_date" });

        var slot = request.Time;
        var type = request.Type?.ToLower() == "walkin" ? AppointmentType.WalkIn : AppointmentType.Scheduled;

        // Check slot availability (excluding cancelled appointments)
        var slotTaken = await _db.Appointments
            .AnyAsync(a => a.DoctorId == request.DoctorId
                && a.Date == date
                && a.TimeSlot == slot
                && a.Status != AppointmentStatus.Cancelled, ct);

        if (slotTaken)
            return Conflict(new { error = "slot_unavailable" });

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            PatientId = request.PatientId,
            DoctorId = request.DoctorId,
            Date = date,
            TimeSlot = slot,
            Type = type,
            Status = AppointmentStatus.Booked,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Appointments.Add(appointment);
        await _db.SaveChangesAsync(ct);

        // Fire-and-forget notification (don't block response)
        _ = Task.Run(async () =>
        {
            try
            {
                var clinic = await _db.Clinics.FindAsync(appointment.ClinicId);
                var dateTime = appointment.Date.ToDateTime(TimeOnly.Parse(appointment.TimeSlot));
                await _notificationService.SendAppointmentConfirmationAsync(
                    appointment.Id,
                    patient.Phone,
                    clinic?.Name ?? "Clinic",
                    dateTime);
            }
            catch (Exception ex)
            {
                // Notification failure must NOT fail the booking
                Console.WriteLine($"[NOTIFICATION FAILED] {ex.Message}");
            }
        });

        return StatusCode(201, new { appointmentId = appointment.Id, queueToken = (int?)null });
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetDailySchedule([FromQuery] string date, [FromQuery] Guid? doctorId, CancellationToken ct)
    {
        if (!DateOnly.TryParse(date, out var queryDate))
            return BadRequest(new { error = "invalid_date" });

        var query = _db.Appointments
            .Include(a => a.Patient)
            .Where(a => a.Date == queryDate && a.Status != AppointmentStatus.Cancelled);

        if (doctorId.HasValue)
            query = query.Where(a => a.DoctorId == doctorId.Value);

        var appointments = await query
            .OrderBy(a => a.TimeSlot)
            .Select(a => new
            {
                appointmentId = a.Id,
                patientName = a.Patient.Name,
                time = a.TimeSlot,
                status = a.Status.ToString().ToLower(),
                queueToken = a.QueueToken
            })
            .ToListAsync(ct);

        return Ok(appointments);
    }

    [HttpPost("{id:guid}/checkin")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> CheckIn(Guid id, CancellationToken ct)
    {
        var appointment = await _db.Appointments.FindAsync([id], ct);
        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        if (appointment.Status != AppointmentStatus.Booked)
            return BadRequest(new { error = "appointment_not_booked" });

        // Next sequential queue token for the day
        var maxToken = await _db.Appointments
            .Where(a => a.Date == appointment.Date && a.QueueToken != null)
            .MaxAsync(a => (int?)a.QueueToken, ct) ?? 0;

        appointment.QueueToken = maxToken + 1;
        appointment.Status = AppointmentStatus.CheckedIn;

        await _db.SaveChangesAsync(ct);

        return Ok(new { queueToken = appointment.QueueToken });
    }

    [HttpPatch("{id:guid}")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAppointmentRequest request, CancellationToken ct)
    {
        var appointment = await _db.Appointments.FindAsync([id], ct);
        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var now = DateTimeOffset.UtcNow;

        if (string.Equals(request.Action, "reschedule", StringComparison.OrdinalIgnoreCase))
        {
            if (appointment.Status == AppointmentStatus.Completed || appointment.Status == AppointmentStatus.Cancelled)
                return BadRequest(new { error = "appointment_not_reschedulable" });

            if (!DateOnly.TryParse(request.NewDate, out var newDate) || string.IsNullOrWhiteSpace(request.NewTime))
                return BadRequest(new { error = "new_date_and_time_required" });

            // Validate new slot
            var slotTaken = await _db.Appointments
                .AnyAsync(a => a.DoctorId == appointment.DoctorId
                    && a.Date == newDate
                    && a.TimeSlot == request.NewTime
                    && a.Status != AppointmentStatus.Cancelled
                    && a.Id != id, ct);

            if (slotTaken)
                return Conflict(new { error = "slot_unavailable" });

            _db.AppointmentHistories.Add(new AppointmentHistory
            {
                Id = Guid.NewGuid(),
                AppointmentId = id,
                PreviousDate = appointment.Date,
                PreviousTimeSlot = appointment.TimeSlot,
                PreviousStatus = appointment.Status,
                ChangedBy = userId,
                ChangedAt = now
            });

            appointment.Date = newDate;
            appointment.TimeSlot = request.NewTime;

            await _db.SaveChangesAsync(ct);
            return Ok(new { appointmentId = appointment.Id, status = appointment.Status.ToString().ToLower() });
        }

        if (string.Equals(request.Action, "cancel", StringComparison.OrdinalIgnoreCase))
        {
            if (appointment.Status == AppointmentStatus.Completed || appointment.Status == AppointmentStatus.Cancelled)
                return BadRequest(new { error = "appointment_not_cancellable" });

            _db.AppointmentHistories.Add(new AppointmentHistory
            {
                Id = Guid.NewGuid(),
                AppointmentId = id,
                PreviousDate = appointment.Date,
                PreviousTimeSlot = appointment.TimeSlot,
                PreviousStatus = appointment.Status,
                ChangedBy = userId,
                ChangedAt = now
            });

            appointment.Status = AppointmentStatus.Cancelled;

            await _db.SaveChangesAsync(ct);
            return Ok(new { appointmentId = appointment.Id, status = appointment.Status.ToString().ToLower() });
        }

        return BadRequest(new { error = "invalid_action" });
    }
}

public record BookAppointmentRequest(
    Guid PatientId,
    Guid DoctorId,
    string Date,
    string Time,
    string? Type);

public record UpdateAppointmentRequest(
    string Action,
    string? NewDate,
    string? NewTime,
    string? Reason);
