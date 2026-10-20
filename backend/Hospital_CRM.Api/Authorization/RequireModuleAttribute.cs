using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Hospital_CRM.Api.Authorization;

/// <summary>
/// Rejects a request when the caller's tenant is not entitled to the module (D6: ActivatedModules
/// with TenantFeatureFlags as overrides). Shared by every module-scoped controller so the gate
/// cannot drift between them.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireModuleAttribute(string module) : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var tenantId = context.HttpContext.User.GetTenantId();
        var gate = context.HttpContext.RequestServices.GetRequiredService<IModuleGateService>();

        if (tenantId is null ||
            !await gate.IsModuleEnabledAsync(tenantId.Value, module, context.HttpContext.RequestAborted))
        {
            context.Result = new ObjectResult(new { error = "module_not_activated", module })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            return;
        }

        await next();
    }
}
