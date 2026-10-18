using Microsoft.AspNetCore.Http;

namespace Hospital_CRM.Api.Services;

public interface ITimezoneService
{
    TimeZoneInfo ResolveTimeZone(HttpContext? httpContext = null, string? clinicTimezone = null);
    DateTime GetLocalNow(HttpContext? httpContext = null, string? clinicTimezone = null);
    DateOnly GetLocalDate(HttpContext? httpContext = null, string? clinicTimezone = null);
    DateOnly GetClinicToday(string? clinicTimezone, HttpContext? httpContext = null);
    DateTime GetStartOfDayUtc(DateOnly date, string? timezoneId);
    DateTime GetEndOfDayUtc(DateOnly date, string? timezoneId);
}

public class TimezoneService : ITimezoneService
{
    public TimeZoneInfo ResolveTimeZone(HttpContext? httpContext = null, string? clinicTimezone = null)
    {
        // 1. Try X-Timezone header from client browser (auto-detected via Intl.DateTimeFormat)
        if (httpContext?.Request.Headers.TryGetValue("X-Timezone", out var headerVal) == true)
        {
            var headerTz = headerVal.ToString().Trim();
            if (!string.IsNullOrEmpty(headerTz) && TryFindTimeZone(headerTz, out var tzFromHeader))
            {
                return tzFromHeader;
            }
        }

        // 2. Try Clinic's configured timezone
        if (!string.IsNullOrWhiteSpace(clinicTimezone) && TryFindTimeZone(clinicTimezone.Trim(), out var tzFromClinic))
        {
            return tzFromClinic;
        }

        // 3. Fallback to UTC
        return TimeZoneInfo.Utc;
    }

    public DateTime GetLocalNow(HttpContext? httpContext = null, string? clinicTimezone = null)
    {
        var tz = ResolveTimeZone(httpContext, clinicTimezone);
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
    }

    public DateOnly GetLocalDate(HttpContext? httpContext = null, string? clinicTimezone = null)
    {
        var localNow = GetLocalNow(httpContext, clinicTimezone);
        return DateOnly.FromDateTime(localNow);
    }

    public DateOnly GetClinicToday(string? clinicTimezone, HttpContext? httpContext = null)
    {
        return GetLocalDate(httpContext, clinicTimezone);
    }

    public DateTime GetStartOfDayUtc(DateOnly date, string? timezoneId)
    {
        var tz = ResolveTimeZone(null, timezoneId);
        var localMidnight = date.ToDateTime(TimeOnly.MinValue);
        var unspecified = DateTime.SpecifyKind(localMidnight, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(unspecified, tz);
    }

    public DateTime GetEndOfDayUtc(DateOnly date, string? timezoneId)
    {
        var tz = ResolveTimeZone(null, timezoneId);
        var localEndOfDay = date.ToDateTime(new TimeOnly(23, 59, 59, 999));
        var unspecified = DateTime.SpecifyKind(localEndOfDay, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(unspecified, tz);
    }

    private static bool TryFindTimeZone(string timeZoneId, out TimeZoneInfo timeZone)
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId, out var found))
        {
            timeZone = found;
            return true;
        }

        // Handle common friendly mappings between Windows and IANA IDs
        var alias = timeZoneId switch
        {
            "IST" or "India Standard Time" => "Asia/Kolkata",
            "GST" or "Gulf Standard Time" or "Dubai" => "Asia/Dubai",
            "EST" or "Eastern Standard Time" => "America/New_York",
            "CST" or "Central Standard Time" => "America/Chicago",
            "PST" or "Pacific Standard Time" => "America/Los_Angeles",
            "GMT" or "BST" or "British Summer Time" => "Europe/London",
            "CET" or "Central European Time" => "Europe/Paris",
            "SGT" or "Singapore Standard Time" => "Asia/Singapore",
            "AEST" or "Australian Eastern Standard Time" => "Australia/Sydney",
            _ => null
        };

        if (alias != null && TimeZoneInfo.TryFindSystemTimeZoneById(alias, out var aliasTz))
        {
            timeZone = aliasTz;
            return true;
        }

        timeZone = TimeZoneInfo.Utc;
        return false;
    }
}
