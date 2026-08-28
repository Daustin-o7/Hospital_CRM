using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Hospital_CRM.Infrastructure.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<HospitalCrmDbContext>
{
    public HospitalCrmDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=hospital_crm;Username=postgres;Password=postgres";

        var optionsBuilder = new DbContextOptionsBuilder<HospitalCrmDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new HospitalCrmDbContext(optionsBuilder.Options);
    }
}