using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Hospital_CRM.Api.Authorization;

/// <summary>
/// Action-level capability check layered on top of <see cref="AuthorizeRolesAttribute"/>.
/// Roles answer "who may reach this area"; permissions answer "what this action does"
/// (e.g. <c>invoice.write</c>), so a new role does not silently inherit a money action.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequirePermissionAttribute(string permission) : Attribute, IAsyncActionFilter
{
    public string Permission { get; } = permission;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!Enum.TryParse<UserRole>(context.HttpContext.User.GetUserRole(), ignoreCase: true, out var role) ||
            !Permissions.RoleHasPermission(role, Permission))
        {
            context.Result = new ObjectResult(new
            {
                error = "insufficient_permissions",
                permission = Permission
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };
            return;
        }

        await next();
    }
}
