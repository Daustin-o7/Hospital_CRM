using Hangfire.Dashboard;

namespace Hospital_CRM.Api.Authorization;

/// <summary>
/// Restricts /hangfire dashboard to ClinicAdmin role only.
/// The existing JWT auth middleware has already populated the user principal.
/// </summary>
public class HangfireAdminAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();
        var user = http.User;
        if (user?.Identity?.IsAuthenticated != true) return false;
        return user.IsInRole("ClinicAdmin") || user.IsInRole("PlatformAdmin");
    }
}
