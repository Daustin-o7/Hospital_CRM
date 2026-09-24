using System.ComponentModel.DataAnnotations;
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

    [HttpGet("consultations")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> List(
        [FromQuery] Guid? doctorId,
        [FromQuery] Guid? patientId,
        [FromQuery] Guid? appointmentId,
        [FromQuery] string? fromDate,
        [FromQuery] string? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var userRole = User.GetUserRole();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var query = _db.Consultations
            .Include(c => c.Appointment).ThenInclude(a => a.Patient)
            .Include(c => c.Doctor)
            .Include(c => c.Prescriptions).ThenInclude(p => p.Items)
            .AsQueryable();

        // Role-based filtering
        if (string.Equals(userRole, "Doctor", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(c => c.DoctorId == userId.Value);
        }
        else if (string.Equals(userRole, "Receptionist", StringComparison.OrdinalIgnoreCase))
        {
            // Receptionist sees consultations for patients they registered or appointments they booked
            // For simplicity, allow access to consultations in their clinic
            var user = await _db.Users.FindAsync([userId.Value], ct);
            if (user?.ClinicId != null)
            {
                query = query.Where(c => c.Appointment.ClinicId == user.ClinicId);
            }
        }
        else if (string.Equals(userRole, "ClinicAdmin", StringComparison.OrdinalIgnoreCase))
        {
            var user = await _db.Users.FindAsync([userId.Value], ct);
            if (user?.ClinicId != null)
            {
                query = query.Where(c => c.Appointment.ClinicId == user.ClinicId);
            }
        }

        // Filters
        if (doctorId.HasValue)
            query = query.Where(c => c.DoctorId == doctorId.Value);

        if (patientId.HasValue)
            query = query.Where(c => c.Appointment.PatientId == patientId.Value);

        if (appointmentId.HasValue)
            query = query.Where(c => c.AppointmentId == appointmentId.Value);

        if (DateOnly.TryParse(fromDate, out var from))
            query = query.Where(c => c.CreatedAt >= from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));

        if (DateOnly.TryParse(toDate, out var to))
            query = query.Where(c => c.CreatedAt < to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));

        var total = await query.CountAsync(ct);

        var consultations = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                consultationId = c.Id,
                appointmentId = c.AppointmentId,
                patientName = c.Appointment.Patient.Name,
                patientPhone = c.Appointment.Patient.Phone,
                doctorName = c.Doctor.Name,
                chiefComplaint = c.ChiefComplaint,
                diagnosis = c.Diagnosis,
                version = c.Version,
                previousVersionId = c.PreviousVersionId,
                createdAt = c.CreatedAt,
                prescriptionCount = c.Prescriptions.Count
            })
            .ToListAsync(ct);

        return Ok(new
        {
            total,
            page,
            pageSize,
            data = consultations
        });
    }

    [HttpGet("consultations/{consultationId:guid}")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> Get(Guid consultationId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        var userRole = User.GetUserRole();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var consultation = await _db.Consultations
            .Include(c => c.Appointment).ThenInclude(a => a.Patient)
            .Include(c => c.Doctor)
            .Include(c => c.Prescriptions).ThenInclude(p => p.Items)
            .FirstOrDefaultAsync(c => c.Id == consultationId, ct);

        if (consultation is null)
            return NotFound(new { error = "consultation_not_found" });

        // Role-based access check
        if (string.Equals(userRole, "Doctor", StringComparison.OrdinalIgnoreCase))
        {
            if (consultation.DoctorId != User.GetUserId().Value)
                return Forbid();
        }
        else if (string.Equals(userRole, "Receptionist", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(userRole, "ClinicAdmin", StringComparison.OrdinalIgnoreCase))
        {
            var user = await _db.Users.FindAsync([User.GetUserId().Value], ct);
            if (user?.ClinicId != null && consultation.Appointment.ClinicId != user.ClinicId)
                return Forbid();
        }

        return Ok(new
        {
            consultationId = consultation.Id,
            appointmentId = consultation.AppointmentId,
            patient = new
            {
                id = consultation.Appointment.Patient.Id,
                name = consultation.Appointment.Patient.Name,
                phone = consultation.Appointment.Patient.Phone
            },
            doctor = new
            {
                id = consultation.Doctor.Id,
                name = consultation.Doctor.Name
            },
            chiefComplaint = consultation.ChiefComplaint,
            observations = consultation.Observations,
            diagnosis = consultation.Diagnosis,
            version = consultation.Version,
            previousVersionId = consultation.PreviousVersionId,
            createdAt = consultation.CreatedAt,
            prescriptions = consultation.Prescriptions.Select(p => new
            {
                prescriptionId = p.Id,
                createdAt = p.CreatedAt,
                items = p.Items.Select(i => new
                {
                    medicine = i.MedicineText,
                    dosage = i.DosageText,
                    frequency = i.FrequencyText,
                    duration = i.DurationText
                }).ToList()
            }).ToList()
        });
    }

    [HttpGet("consultations/{consultationId:guid}/prescriptions")]
    [AuthorizeRoles("ClinicAdmin", "Doctor", "Receptionist")]
    public async Task<IActionResult> GetPrescriptions(Guid consultationId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        var userRole = User.GetUserRole();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var consultation = await _db.Consultations
            .Include(c => c.Appointment)
            .Include(c => c.Prescriptions).ThenInclude(p => p.Items)
            .FirstOrDefaultAsync(c => c.Id == consultationId, ct);

        if (consultation is null)
            return NotFound(new { error = "consultation_not_found" });

        // Role-based access check
        if (string.Equals(userRole, "Doctor", StringComparison.OrdinalIgnoreCase))
        {
            if (consultation.DoctorId != User.GetUserId().Value)
                return Forbid();
        }
        else if (string.Equals(userRole, "Receptionist", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(userRole, "ClinicAdmin", StringComparison.OrdinalIgnoreCase))
        {
            var user = await _db.Users.FindAsync([User.GetUserId().Value], ct);
            if (user?.ClinicId != null && consultation.Appointment.ClinicId != user.ClinicId)
                return Forbid();
        }

        var prescriptions = consultation.Prescriptions.Select(p => new
        {
            prescriptionId = p.Id,
            createdAt = p.CreatedAt,
            items = p.Items.Select(i => new
            {
                medicine = i.MedicineText,
                dosage = i.DosageText,
                frequency = i.FrequencyText,
                duration = i.DurationText
            }).ToList()
        }).ToList();

        return Ok(new { consultationId, prescriptions });
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

public record CreateConsultationRequest(
    [StringLength(1000, MinimumLength = 3, ErrorMessage = "Chief complaint must be between 3 and 1000 characters")]
    string? ChiefComplaint,

    [StringLength(2500, ErrorMessage = "Observations cannot exceed 2500 characters")]
    string? Observations,

    [StringLength(500, MinimumLength = 2, ErrorMessage = "Diagnosis must be between 2 and 500 characters")]
    string? Diagnosis,

    Guid? PreviousVersionId);

public record AddPrescriptionRequest(
    [Required, MinLength(1, ErrorMessage = "At least one prescription item is required"), MaxLength(30, ErrorMessage = "Maximum 30 prescription items")]
    List<PrescriptionItemRequest> Items);

public record PrescriptionItemRequest(
    [Required(ErrorMessage = "Medicine name is required"), StringLength(200, MinimumLength = 2, ErrorMessage = "Medicine name must be 2–200 characters")]
    string Medicine,

    [Required(ErrorMessage = "Dosage is required"), StringLength(100, MinimumLength = 1)]
    string Dosage,

    [Required(ErrorMessage = "Frequency is required"), StringLength(100, MinimumLength = 1)]
    string Frequency,

    [Required(ErrorMessage = "Duration is required"), StringLength(100, MinimumLength = 1)]
    string Duration);
