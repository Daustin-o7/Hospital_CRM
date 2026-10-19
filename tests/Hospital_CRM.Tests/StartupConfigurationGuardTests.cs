using Hospital_CRM.Api.Configuration;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace Hospital_CRM.Tests;

/// <summary>
/// P0-3: Production must refuse to start on the values shipped in appsettings.json.
/// </summary>
public class StartupConfigurationGuardTests
{
    private static IConfiguration Config(params (string Key, string? Value)[] pairs) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(pairs.Select(p => new KeyValuePair<string, string?>(p.Key, p.Value)))
            .Build();

    private sealed class FakeEnv(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Hospital_CRM.Tests";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static readonly (string, string?)[] DevDefaults =
    [
        ("ConnectionStrings:DefaultConnection", "Host=localhost;Port=5432;Database=hospital_crm;Username=postgres;Password=postgres"),
        ("Jwt:Issuer", "Hospital_CRM"),
        ("Jwt:Audience", "Hospital_CRM"),
        ("Razorpay:KeySecret", ""),
        ("Razorpay:WebhookSecret", ""),
        ("WhatsApp:AccessToken", ""),
    ];

    private static readonly (string, string?)[] ProductionValues =
    [
        ("ConnectionStrings:DefaultConnection", "Host=db;Port=5432;Database=hospital_crm;Username=app_user;Password=s3cret-from-vault"),
        ("Jwt:Issuer", "hospital-crm-samstack"),
        ("Jwt:Audience", "hospital-crm-samstack"),
        ("Razorpay:KeySecret", "rzp_live_secret"),
        ("Razorpay:WebhookSecret", "whsec_from_vault"),
        ("WhatsApp:AccessToken", "EAAG_from_vault"),
    ];

    [Fact]
    public void Production_with_development_defaults_throws()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupConfigurationGuard.Validate(Config(DevDefaults), new FakeEnv("Production")));

        Assert.Contains("development defaults", ex.Message);
        Assert.Contains("ConnectionStrings:DefaultConnection", ex.Message);
        Assert.Contains("Razorpay:KeySecret", ex.Message);
        Assert.Contains("WhatsApp:AccessToken", ex.Message);
    }

    [Fact]
    public void Production_with_real_secrets_passes()
    {
        StartupConfigurationGuard.Validate(Config(ProductionValues), new FakeEnv("Production"));
    }

    [Fact]
    public void Development_with_development_defaults_passes()
    {
        StartupConfigurationGuard.Validate(Config(DevDefaults), new FakeEnv("Development"));
    }

    [Fact]
    public void Production_partially_configured_lists_only_the_missing_keys()
    {
        var partial = ProductionValues
            .Select(p => p.Item1 == "Razorpay:KeySecret" ? ("Razorpay:KeySecret", "") : p)
            .ToArray();

        var ex = Assert.Throws<InvalidOperationException>(
            () => StartupConfigurationGuard.Validate(Config(partial), new FakeEnv("Staging")));

        Assert.Contains("Razorpay:KeySecret", ex.Message);
        Assert.DoesNotContain("WhatsApp:AccessToken", ex.Message);
    }
}
