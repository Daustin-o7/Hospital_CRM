namespace Hospital_CRM.Api.Middlewares;

/// <summary>
/// A1 / Section 0: an account must finish mandatory setup before using the console —
/// replace a bootstrapped password, and enrol a second factor when the role requires it.
/// Both facts ride in the token, so this costs no query.
/// </summary>
public class AccountSetupEnforcementMiddleware
{
    private readonly RequestDelegate _next;

    private static readonly HashSet<string> AllowedWhileSetupPending = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/v1/auth/change-password",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/auth/mfa/status",
        "/api/v1/auth/mfa/setup",
        "/api/v1/auth/mfa/enable"
    };

    public AccountSetupEnforcementMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            var path = context.Request.Path.Value ?? string.Empty;

            if (!AllowedWhileSetupPending.Contains(path))
            {
                var mustChangePassword = IsTrue(context, "must_change_password");
                var mustEnrolMfa = IsTrue(context, "mfa_enrolment_required");

                if (mustChangePassword)
                {
                    await WriteAsync(context, "password_change_required",
                        "Change the temporary password before continuing.");
                    return;
                }

                if (mustEnrolMfa)
                {
                    await WriteAsync(context, "mfa_enrolment_required",
                        "Two-factor authentication is mandatory for this role. Enrol before continuing.");
                    return;
                }
            }
        }

        await _next(context);
    }

    private static bool IsTrue(HttpContext context, string claimType) =>
        string.Equals(context.User.FindFirst(claimType)?.Value, "true", StringComparison.OrdinalIgnoreCase);

    private static async Task WriteAsync(HttpContext context, string error, string message)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { error, message });
    }
}
