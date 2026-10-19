using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Hospital_CRM.Infrastructure.Data;

/// <summary>
/// Design-time only, used by <c>dotnet ef</c>. Prefers <c>MigrationsConnection</c> (the
/// schema owner) because the runtime <c>DefaultConnection</c> role is least-privilege and
/// is deliberately not allowed to alter the schema.
/// </summary>
public class HospitalCrmDbContextFactory : IDesignTimeDbContextFactory<HospitalCrmDbContext>
{
    public HospitalCrmDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(ResolveBasePath())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        // Falls back to DefaultConnection so `dotnet ef migrations add` still works for
        // anyone running with a single privileged connection (the Docker path).
        var connection = config.GetConnectionString("MigrationsConnection")
            ?? config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "No MigrationsConnection or DefaultConnection found. Run dotnet ef from the repo root, " +
                "backend/Hospital_CRM.Api, or backend/Hospital_CRM.Infrastructure.");

        return new HospitalCrmDbContext(
            new DbContextOptionsBuilder<HospitalCrmDbContext>().UseNpgsql(connection).Options);
    }

    private static string ResolveBasePath()
    {
        var candidates = new[]
        {
            Directory.GetCurrentDirectory(),
            Path.Combine(Directory.GetCurrentDirectory(), "backend", "Hospital_CRM.Api"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "Hospital_CRM.Api"),
        };

        return candidates.FirstOrDefault(p => File.Exists(Path.Combine(p, "appsettings.json")))
            ?? Directory.GetCurrentDirectory();
    }
}
