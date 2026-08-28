using Hospital_CRM.Api.Authorization;
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
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "name_required" });

        if (request.WorkingHours is null || request.WorkingHours.Count == 0)
            return BadRequest(new { error = "at_least_one_working_day_required" });

        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync([userId], ct);
        if (user?.ClinicId is null)
            return Forbid();

        var clinic = await _db.Clinics.FindAsync([user.ClinicId], ct);
        if (clinic is null)
            return NotFound(new { error = "clinic_not_found" });

        clinic.Name = request.Name;

        var existingHours = await _db.ClinicHours.Where(h => h.ClinicId == clinic.Id).ToListAsync(ct);
        _db.ClinicHours.RemoveRange(existingHours);

        foreach (var wh in request.WorkingHours)
        {
            var dayNum = ParseDayOfWeek(wh.Day);
            if (dayNum is null)
                return BadRequest(new { error = $"invalid_day: {wh.Day}" });

            _db.ClinicHours.Add(new ClinicHours
            {
                Id = Guid.NewGuid(),
                ClinicId = clinic.Id,
                DayOfWeek = dayNum.Value,
                OpenTime = wh.Open,
                CloseTime = wh.Close
            });
        }

        var existingHolidays = await _db.ClinicHolidays.Where(h => h.ClinicId == clinic.Id).ToListAsync(ct);
        _db.ClinicHolidays.RemoveRange(existingHolidays);

        if (request.Holidays is not null)
        {
            foreach (var holiday in request.Holidays)
            {
                _db.ClinicHolidays.Add(new ClinicHoliday
                {
                    Id = Guid.NewGuid(),
                    ClinicId = clinic.Id,
                    Date = holiday
                });
            }
        }

        await _db.SaveChangesAsync(ct);

        return Ok(new { clinicId = clinic.Id, name = clinic.Name });
    }

    [HttpGet("profile")]
    [Authorize]
    public async Task<IActionResult> GetProfile(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);
        var user = await _db.Users.FindAsync([userId], ct);
        if (user?.ClinicId is null)
            return Forbid();

        var clinic = await _db.Clinics
            .Include(c => c.WorkingHours.OrderBy(h => h.DayOfWeek))
            .Include(c => c.Holidays.OrderBy(h => h.Date))
            .FirstOrDefaultAsync(c => c.Id == user.ClinicId, ct);

        if (clinic is null)
            return NotFound(new { error = "clinic_not_found" });

        return Ok(new
        {
            clinicId = clinic.Id,
            name = clinic.Name,
            workingHours = clinic.WorkingHours.Select(h => new
            {
                day = ((DayOfWeek)h.DayOfWeek).ToString().ToLower(),
                open = h.OpenTime,
                close = h.CloseTime
            }),
            holidays = clinic.Holidays.Select(h => h.Date)
        });
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

public record ClinicProfileRequest(string Name, List<WorkingHoursRequest>? WorkingHours, List<string>? Holidays);
public record WorkingHoursRequest(string Day, string Open, string Close);
