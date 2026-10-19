namespace Hospital_CRM.Api.Middlewares;

/// <summary>
/// A6: restricts <c>/api/v1/platform-admin/*</c> to allow-listed source IPs.
/// Disabled when <c>PlatformAdmin:AllowedIps</c> is empty, and always disabled in
/// Development. Depends on UseForwardedHeaders having run so RemoteIpAddress is
/// the real client address behind a proxy.
/// </summary>
public class PlatformAdminIpAllowlistMiddleware
{
    private const string PathPrefix = "/api/v1/platform-admin";

    private readonly RequestDelegate _next;
    private readonly ILogger<PlatformAdminIpAllowlistMiddleware> _logger;
    private readonly bool _enabled;
    private readonly HashSet<string> _allowed;

    public PlatformAdminIpAllowlistMiddleware(
        RequestDelegate next,
        IConfiguration config,
        IHostEnvironment env,
        ILogger<PlatformAdminIpAllowlistMiddleware> logger)
    {
        _next = next;
        _logger = logger;

        // shortcut: exact-IP match only, no CIDR ranges — upgrade when a client needs a subnet.
        _allowed = new HashSet<string>(
            config["PlatformAdmin:AllowedIps"]
                ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                ?? [],
            StringComparer.OrdinalIgnoreCase);

        _enabled = !env.IsDevelopment() && _allowed.Count > 0;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!_enabled || !context.Request.Path.StartsWithSegments(PathPrefix))
        {
            await _next(context);
            return;
        }

        var ip = context.Connection.RemoteIpAddress?.ToString();
        if (ip is not null && _allowed.Contains(ip))
        {
            await _next(context);
            return;
        }

        _logger.LogWarning("Blocked platform-admin request from non-allowlisted IP {Ip}", ip ?? "unknown");
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { error = "ip_not_allowed" });
    }
}
