using Hospital_CRM.Api.Extensions;
using Microsoft.AspNetCore.Authorization;

namespace Hospital_CRM.Api.Authorization;

public class RbacRequirement : IAuthorizationRequirement
{
    public string[] AllowedRoles { get; }

    public RbacRequirement(params string[] allowedRoles)
    {
        AllowedRoles = allowedRoles;
    }
}

public class RbacHandler : AuthorizationHandler<RbacRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, RbacRequirement requirement)
    {
        var role = context.User.GetUserRole();
        if (role != null && requirement.AllowedRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
