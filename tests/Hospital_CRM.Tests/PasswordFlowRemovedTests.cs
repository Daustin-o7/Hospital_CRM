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
        var candidateRoots = new[]
        {
            AppContext.BaseDirectory,
            Directory.GetCurrentDirectory(),
            AppDomain.CurrentDomain.BaseDirectory
        };

        foreach (var root in candidateRoots)
        {
            var dir = new DirectoryInfo(root);
            while (dir is not null)
            {
                var candidate = Path.Combine(dir.FullName, relativePath);
                if (File.Exists(candidate))
                    return candidate;
                dir = dir.Parent;
            }
        }

        // Try walking up from current directory looking for repo markers
        var cur = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (cur is not null)
        {
            var candidate = Path.Combine(cur.FullName, relativePath);
            if (File.Exists(candidate))
                return candidate;
            cur = cur.Parent;
        }

        throw new FileNotFoundException($"Could not locate repository file '{relativePath}' from '{AppContext.BaseDirectory}' or '{Directory.GetCurrentDirectory()}'.");
    }
}
