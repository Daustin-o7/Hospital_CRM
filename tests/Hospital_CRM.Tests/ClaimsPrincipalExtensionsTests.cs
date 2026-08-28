using System.Security.Claims;
using Hospital_CRM.Api.Extensions;
using Xunit;

namespace Hospital_CRM.Tests;

public class ClaimsPrincipalExtensionsTests
{
    [Fact]
    public void GetUserId_ReturnsGuid_WhenSubClaimValid()
    {
        var expectedId = Guid.NewGuid();
        var claims = new[] { new Claim("sub", expectedId.ToString()) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var result = principal.GetUserId();

        Assert.Equal(expectedId, result);
    }

    [Fact]
    public void GetUserId_ReturnsNull_WhenUserIsNull()
    {
        ClaimsPrincipal? principal = null;
        var result = principal.GetUserId();
        Assert.Null(result);
    }

    [Fact]
    public void GetUserRole_ReturnsRoleString_WhenClaimExists()
    {
        var claims = new[] { new Claim("role", "Doctor") };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var result = principal.GetUserRole();

        Assert.Equal("Doctor", result);
    }
}
