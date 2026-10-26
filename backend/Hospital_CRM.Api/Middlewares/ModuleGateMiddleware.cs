using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;

namespace Hospital_CRM.Api.Middlewares;

/// <summary>
/// Section 0, step 2/3: evaluate the module entitlement and kill switch before role
/// authorization, so a tenant that never bought (or has had switched off) a module gets
/// <c>module_not_activated</c> / <c>module_disabled</c> rather than a role error.
/// </summary>
public class ModuleGateMiddleware
{
    private readonly RequestDelegate _next;

    public ModuleGateMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, IModuleGateService gate)
    {
        var requirement = context.GetEndpoint()?.Metadata.GetMetadata<RequireModuleAttribute>();

        if (requirement is not null && context.User?.Identity?.IsAuthenticated == true)
        {
            var tenantId = context.User.GetTenantId();

            var status = tenantId is null
                ? ModuleGateStatus.NotEntitled
                : await gate.EvaluateAsync(tenantId.Value, requirement.Module, context.RequestAborted);

            if (status != ModuleGateStatus.Enabled)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = status == ModuleGateStatus.Disabled ? "module_disabled" : "module_not_activated",
                    module = requirement.Module
                });
                return;
            }
        }

        await _next(context);
    }
}
