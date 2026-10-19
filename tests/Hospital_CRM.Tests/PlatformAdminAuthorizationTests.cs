using System.Reflection;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>
/// A6: every platform-admin action must stay gated to the PlatformAdmin role.
/// Fails if a new action is added without the role gate, or with [AllowAnonymous].
/// </summary>
public class PlatformAdminAuthorizationTests
{
    private static IEnumerable<MethodInfo> Actions() =>
        typeof(PlatformAdminController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => !m.IsSpecialName)
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>(inherit: true).Any());

    [Fact]
    public void Controller_has_at_least_one_action()
    {
        Assert.NotEmpty(Actions());
    }

    [Fact]
    public void Every_action_is_gated_to_PlatformAdmin()
    {
        var controllerRoles = typeof(PlatformAdminController)
            .GetCustomAttributes<AuthorizeRolesAttribute>(inherit: true)
            .ToList();

        var ungated = new List<string>();

        foreach (var action in Actions())
        {
            var methodRoles = action.GetCustomAttributes<AuthorizeRolesAttribute>(inherit: true).ToList();
            var roles = methodRoles.Count > 0 ? methodRoles : controllerRoles;

            var covers = roles.Any(r =>
                (r.Roles ?? string.Empty)
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Contains("PlatformAdmin", StringComparer.OrdinalIgnoreCase));

            if (!covers) ungated.Add(action.Name);
        }

        Assert.True(ungated.Count == 0,
            $"These platform-admin actions are not gated to PlatformAdmin: {string.Join(", ", ungated)}");
    }

    [Fact]
    public void No_action_permits_anonymous_access()
    {
        var anonymous = Actions()
            .Where(m => m.GetCustomAttributes<AllowAnonymousAttribute>(inherit: true).Any())
            .Select(m => m.Name)
            .ToList();

        Assert.True(anonymous.Count == 0,
            $"These platform-admin actions allow anonymous access: {string.Join(", ", anonymous)}");
    }
}
