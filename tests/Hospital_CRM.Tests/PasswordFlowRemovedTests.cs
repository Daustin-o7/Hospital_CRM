using System.IO;
using Xunit;

namespace Hospital_CRM.Tests;

// Source guard: `Program.cs` is top-level setup, so there is no host to reflect over.
// The resource-owner password grant skips every step-up/MFA path, so it must stay gone.
public class PasswordFlowRemovedTests
{
    [Fact]
    public void OpenIddict_DoesNotExpose_ResourceOwnerPasswordGrant()
    {
        var source = File.ReadAllText(RepoFile("backend/Hospital_CRM.Api/Program.cs"));

        Assert.DoesNotContain("AllowPasswordFlow", source);
        Assert.DoesNotContain("Permissions.GrantTypes.Password", source);
    }

    private static string RepoFile(string relativePath)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, relativePath)))
            dir = dir.Parent;

        Assert.NotNull(dir);
        return Path.Combine(dir!.FullName, relativePath);
    }
}
