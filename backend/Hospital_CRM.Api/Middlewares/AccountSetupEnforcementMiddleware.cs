namespace Hospital_CRM.Api.Middlewares;

/// <summary>
/// A1: an account bootstrapped for production must replace the one-time password and enrol
/// TOTP before using the console. Both facts ride in the token, so this costs no query.
/// </summary>
public class AccountSetupEnforcementMiddleware
{
    private readonly RequestDelegate _next;

    private static readonly HashSet<string> AllowedWhilePasswordChangePending = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/v1/auth/change-password",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout"
    };

    private static readonly HashSet<string> AllowedWhileMfaSetupPending = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/v1/auth/mfa/setup",
        "/api/v1/auth/mfa/enable",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout"
    };

    public AccountSetupEnforcementMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User?.Identity?.IsAuthenticated == true)
        {
            var path = context.Request.Path.Value ?? string.Empty;

            var mustChangePassword = string.Equals(
                context.User.FindFirst("must_change_password")?.Value, "true", StringComparison.OrdinalIgnoreCase);

            if (mustChangePassword && !AllowedWhilePasswordChangePending.Contains(path))
            {
                await WriteAsync(context, "password_change_required",
                    "Change the temporary password before continuing.");
                return;
            }

            var isPlatformAdmin = string.Equals(
                context.User.FindFirst("role")?.Value, "PlatformAdmin", StringComparison.OrdinalIgnoreCase);
            var mfaEnabled = string.Equals(
                context.User.FindFirst("mfa_enabled")?.Value, "true", StringComparison.OrdinalIgnoreCase);

            if (isPlatformAdmin && !mfaEnabled && !mustChangePassword && !AllowedWhileMfaSetupPending.Contains(path))
            {
                await WriteAsync(context, "mfa_setup_required",
                    "Enrol an authenticator app before using the platform console.");
                return;
            }
        }

        await _next(context);
    }

    private static async Task WriteAsync(HttpContext context, string error, string message)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { error, message });
    }
}
