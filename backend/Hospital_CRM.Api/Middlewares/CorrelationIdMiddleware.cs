using Serilog.Context;

namespace Hospital_CRM.Api.Middlewares;

/// <summary>
/// Intercepts every incoming HTTP request to propagate or generate a standard X-Correlation-ID.
/// Pushes the correlation identifier into the ambient Serilog LogContext for distributed tracing.
/// </summary>
public class CorrelationIdMiddleware
{
    public const string CorrelationHeaderName = "X-Correlation-ID";
    public const string AltHeaderName = "X-Request-ID";

    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // 1. Check incoming headers for existing correlation ID
        var correlationId = context.Request.Headers[CorrelationHeaderName].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(correlationId))
        {
            correlationId = context.Request.Headers[AltHeaderName].FirstOrDefault();
        }

        // 2. Generate a clean UUID if missing or malformed (cap length at 64 chars to prevent log abuse)
        if (string.IsNullOrWhiteSpace(correlationId) || correlationId.Length > 64)
        {
            correlationId = Guid.NewGuid().ToString("D");
        }
        else
        {
            correlationId = correlationId.Trim();
        }

        // 3. Set on current context and trace identifier
        context.TraceIdentifier = correlationId;

        // 4. Attach to response headers so client/caller can trace errors
        context.Response.OnStarting(() =>
        {
            if (!context.Response.Headers.ContainsKey(CorrelationHeaderName))
            {
                context.Response.Headers[CorrelationHeaderName] = correlationId;
            }
            return Task.CompletedTask;
        });

        // 5. Enrich Serilog LogContext for the duration of this request
        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }
}

public static class CorrelationIdMiddlewareExtensions
{
    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app)
        => app.UseMiddleware<CorrelationIdMiddleware>();
}
