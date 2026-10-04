using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace Hospital_CRM.Api.Middlewares;

public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        // Prevent MIME type sniffing
        headers["X-Content-Type-Options"] = "nosniff";

        // Prevent clickjacking
        headers["X-Frame-Options"] = "DENY";

        // XSS protection (legacy but harmless)
        headers["X-XSS-Protection"] = "1; mode=block";

        // Referrer policy
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

        // Permissions policy (restrict sensitive features)
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";

        // HSTS - only in production with HTTPS
        if (!context.Request.IsHttps && context.Request.Host.Host != "localhost")
        {
            // In production behind proxy, check X-Forwarded-Proto
            var forwardedProto = context.Request.Headers["X-Forwarded-Proto"].FirstOrDefault();
            if (forwardedProto == "https")
            {
                headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
            }
        }
        else if (context.Request.IsHttps)
        {
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
        }

        // CSP for API responses (restrictive)
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

        // Remove server header
        headers.Remove("Server");

        await _next(context);
    }
}

public static class SecurityHeadersMiddlewareExtensions
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
        => app.UseMiddleware<SecurityHeadersMiddleware>();
}