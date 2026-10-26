using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Hospital_CRM.Api.Authorization;

/// <summary>
/// Rejects a request when the caller's tenant is not entitled to the module (D6: ActivatedModules
/// with TenantFeatureFlags as overrides). Shared by every module-scoped controller so the gate
/// cannot drift between them. Also read by <see cref="Middlewares.ModuleGateMiddleware"/> so the
/// check runs before role authorization.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireModuleAttribute(string module) : Attribute, IAsyncActionFilter
{
    public string Module { get; } = module;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var tenantId = context.HttpContext.User.GetTenantId();
        var gate = context.HttpContext.RequestServices.GetRequiredService<IModuleGateService>();

        var status = tenantId is null
            ? ModuleGateStatus.NotEntitled
            : await gate.EvaluateAsync(tenantId.Value, Module, context.HttpContext.RequestAborted);

        if (status != ModuleGateStatus.Enabled)
        {
            context.Result = ModuleGateResponse.Forbidden(status, Module);
            return;
        }

        await next();
    }
}

public static class ModuleGateResponse
{
    public static ObjectResult Forbidden(ModuleGateStatus status, string module) => new(new
    {
        error = status == ModuleGateStatus.Disabled ? "module_disabled" : "module_not_activated",
        module
    })
    {
        StatusCode = StatusCodes.Status403Forbidden
    };
}
