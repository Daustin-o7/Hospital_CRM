using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class ClinicController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public ClinicController(HospitalCrmDbContext db)
    {
        _db = db;
    }

    [HttpPut("profile")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> UpdateProfile([FromBody] ClinicProfileRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "name_required" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user?.ClinicId is null)
            return Forbid();

        var clinic = await _db.Clinics.FindAsync([user.ClinicId], ct);
        if (clinic is null)
            return NotFound(new { error = "clinic_not_found" });

        clinic.Name = request.Name;
        clinic.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return Ok(new { clinicId = clinic.Id, name = clinic.Name });
    }

    [HttpGet("profile")]
    [Authorize]
    public async Task<IActionResult> GetProfile(CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "not_authenticated" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user?.ClinicId is null)
            return Forbid();

        var clinic = await _db.Clinics
            .Include(c => c.WorkingHours)
            .Include(c => c.Holidays)
            .Include(c => c.SpecialHours)
            .FirstOrDefaultAsync(c => c.Id == user.ClinicId, ct);

        if (clinic is null)
            return NotFound(new { error = "clinic_not_found" });

        var workingHours = clinic.WorkingHours ?? new List<ClinicHours>();
        var holidays = clinic.Holidays ?? new List<ClinicHoliday>();
        var specialHours = clinic.SpecialHours ?? new List<ClinicSpecialHour>();

        return Ok(new
        {
            clinicId = clinic.Id,
            name = clinic.Name,
            organizationType = clinic.OrganizationType,
            legalName = clinic.LegalName,
            address = clinic.Address,
            phone = clinic.Phone,
            email = clinic.Email,
            website = clinic.Website,
            timezone = clinic.Timezone,
            currency = clinic.Currency,
            dateFormat = clinic.DateFormat,
            timeFormat = clinic.TimeFormat,
            language = clinic.Language,
            logoUrl = clinic.LogoUrl,
            darkLogoUrl = clinic.DarkLogoUrl,
            lightLogoUrl = clinic.LightLogoUrl,
            faviconUrl = clinic.FaviconUrl,
            primaryColor = clinic.PrimaryColor,
            secondaryColor = clinic.SecondaryColor,
            accentColor = clinic.AccentColor,
            defaultAppointmentDurationMinutes = clinic.DefaultAppointmentDurationMinutes,
            bufferMinutes = clinic.BufferMinutes,
            minAdvanceBookingHours = clinic.MinAdvanceBookingHours,
            maxAdvanceBookingDays = clinic.MaxAdvanceBookingDays,
            sameDayBookingAllowed = clinic.SameDayBookingAllowed,
            walkInsAllowed = clinic.WalkInsAllowed,
            overbookingAllowed = clinic.OverbookingAllowed,
            cancellationWindowHours = clinic.CancellationWindowHours,
            reschedulingAllowed = clinic.ReschedulingAllowed,
            noShowHandlingEnabled = clinic.NoShowHandlingEnabled,
            queueEnabled = clinic.QueueEnabled,
            tokenFormat = clinic.TokenFormat,
            tokenStartNumber = clinic.TokenStartNumber,
            tokenResetFrequency = clinic.TokenResetFrequency,
            invoicePrefix = clinic.InvoicePrefix,
            defaultConsultationFee = clinic.DefaultConsultationFee,
            defaultGstRate = clinic.DefaultGstRate,
            defaultInvoiceStatus = clinic.DefaultInvoiceStatus,
            workingHours = workingHours
                .OrderBy(h => h.DayOfWeek)
                .ThenBy(h => h.ShiftIndex)
                .Select(h => new
                {
                    day = ((DayOfWeek)h.DayOfWeek).ToString().ToLower(),
                    shiftIndex = h.ShiftIndex,
                    open = h.OpenTime,
                    close = h.CloseTime
                }),
            holidays = holidays
                .OrderBy(h => h.StartDate)
                .Select(h => new
                {
                    id = h.Id,
                    name = h.Name,
                    startDate = h.StartDate,
                    endDate = h.EndDate,
                    recurringAnnually = h.RecurringAnnually,
                    internalNote = h.InternalNote
                }),
            specialHours = specialHours
                .OrderBy(s => s.Date)
                .Select(s => new
                {
                    id = s.Id,
                    date = s.Date,
                    open = s.OpenTime,
                    close = s.CloseTime,
                    reason = s.Reason
                })
        });
    }

    [HttpPut("hours")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> UpdateHours([FromBody] UpdateHoursRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user?.ClinicId is null)
            return Forbid();

        var clinicId = user.ClinicId.Value;
        var executionStrategy = _db.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(ct);

            var existing = await _db.ClinicHours
                .Where(h => h.ClinicId == clinicId)
                .ToListAsync(ct);
            _db.ClinicHours.RemoveRange(existing);

            if (request.WorkingHours is not null)
            {
                foreach (var wh in request.WorkingHours)
                {
                    var dayNum = ParseDayOfWeek(wh.Day);
                    if (dayNum is null)
                        return BadRequest(new { error = $"invalid_day: {wh.Day}" });

                    _db.ClinicHours.Add(new ClinicHours
                    {
                        Id = Guid.NewGuid(),
                        ClinicId = clinicId,
                        DayOfWeek = dayNum.Value,
                        ShiftIndex = wh.ShiftIndex,
                        OpenTime = wh.Open,
                        CloseTime = wh.Close,
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    });
                }
            }

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Ok(new { message = "working_hours_updated" });
        });
    }

    [HttpPost("holidays")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> AddHoliday([FromBody] HolidayRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user?.ClinicId is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.StartDate) || string.IsNullOrWhiteSpace(request.EndDate))
            return BadRequest(new { error = "start_date_and_end_date_required" });

        if (string.Compare(request.StartDate, request.EndDate, StringComparison.Ordinal) > 0)
            return BadRequest(new { error = "end_date_must_be_on_or_after_start_date" });

        var holiday = new ClinicHoliday
        {
            Id = Guid.NewGuid(),
            ClinicId = user.ClinicId.Value,
            Name = request.Name ?? "Holiday",
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            RecurringAnnually = request.RecurringAnnually,
            InternalNote = request.InternalNote,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.ClinicHolidays.Add(holiday);
        await _db.SaveChangesAsync(ct);

        return Ok(new { holidayId = holiday.Id, name = holiday.Name, startDate = holiday.StartDate, endDate = holiday.EndDate });
    }

    [HttpDelete("holidays/{id:guid}")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> DeleteHoliday(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user?.ClinicId is null)
            return Forbid();

        var holiday = await _db.ClinicHolidays
            .FirstOrDefaultAsync(h => h.Id == id && h.ClinicId == user.ClinicId, ct);
        if (holiday is null)
            return NotFound(new { error = "holiday_not_found" });

        _db.ClinicHolidays.Remove(holiday);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "holiday_deleted" });
    }

    [HttpPost("special-hours")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> AddSpecialHour([FromBody] SpecialHourRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user?.ClinicId is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Date))
            return BadRequest(new { error = "date_required" });

        var special = new ClinicSpecialHour
        {
            Id = Guid.NewGuid(),
            ClinicId = user.ClinicId.Value,
            Date = request.Date,
            OpenTime = request.Open,
            CloseTime = request.Close,
            Reason = request.Reason,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.ClinicSpecialHours.Add(special);
        await _db.SaveChangesAsync(ct);

        return Ok(new { specialId = special.Id, date = special.Date, open = special.OpenTime, close = special.CloseTime });
    }

    [HttpDelete("special-hours/{id:guid}")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> DeleteSpecialHour(Guid id, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var user = await _db.Users.FindAsync([userId.Value], ct);
        if (user?.ClinicId is null)
            return Forbid();

        var special = await _db.ClinicSpecialHours
            .FirstOrDefaultAsync(s => s.Id == id && s.ClinicId == user.ClinicId, ct);
        if (special is null)
            return NotFound(new { error = "special_hour_not_found" });

        _db.ClinicSpecialHours.Remove(special);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "special_hour_deleted" });
    }

    private static int? ParseDayOfWeek(string day)
    {
        return day.ToLower() switch
        {
            "sun" or "sunday" => 0,
            "mon" or "monday" => 1,
            "tue" or "tuesday" => 2,
            "wed" or "wednesday" => 3,
            "thu" or "thursday" => 4,
            "fri" or "friday" => 5,
            "sat" or "saturday" => 6,
            _ => null
        };
    }
}

public record ClinicProfileRequest(string Name);
public record WorkingHoursRequest(string Day, int ShiftIndex, string Open, string Close);
public record UpdateHoursRequest(List<WorkingHoursRequest>? WorkingHours);
public record HolidayRequest(string? Name, string StartDate, string EndDate, bool RecurringAnnually, string? InternalNote);
public record SpecialHourRequest(string Date, string Open, string Close, string? Reason);