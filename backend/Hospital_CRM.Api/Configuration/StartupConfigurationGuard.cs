namespace Hospital_CRM.Api.Configuration;

/// <summary>
/// P0-3: refuses to start outside Development when a required secret is missing
/// or is still the value shipped in <c>appsettings.json</c> (a known dev default).
/// </summary>
public static class StartupConfigurationGuard
{
    // Values that ship in appsettings.json and must never reach a real environment.
    private const string DevDbMarker = "Username=postgres";
    private const string DevJwtValue = "Hospital_CRM";

    private static readonly string[] RequiredSecrets =
    [
        "Razorpay:KeySecret",
        "Razorpay:WebhookSecret",
        "WhatsApp:AccessToken",
    ];

    public static void Validate(IConfiguration config, IHostEnvironment env)
    {
        if (env.IsDevelopment()) return;

        var problems = new List<string>();

        var db = config.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(db) || db.Contains(DevDbMarker, StringComparison.OrdinalIgnoreCase))
            problems.Add("ConnectionStrings:DefaultConnection is missing or still connects as the development superuser (Username=postgres).");

        if (string.Equals(config["Jwt:Issuer"], DevJwtValue, StringComparison.Ordinal) ||
            string.Equals(config["Jwt:Audience"], DevJwtValue, StringComparison.Ordinal))
            problems.Add("Jwt:Issuer / Jwt:Audience are still the development defaults.");

        foreach (var key in RequiredSecrets)
            if (string.IsNullOrWhiteSpace(config[key]))
                problems.Add($"{key} is not set.");

        if (problems.Count > 0)
            throw new InvalidOperationException(
                $"Refusing to start in '{env.EnvironmentName}' with development defaults. " +
                "Supply these via environment variables or Key Vault:\n  - " +
                string.Join("\n  - ", problems));
    }
}
