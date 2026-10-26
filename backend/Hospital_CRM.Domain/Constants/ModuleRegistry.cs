namespace Hospital_CRM.Domain.Constants;

/// <summary>
/// Registry of module codes stored in <c>Clinic.ActivatedModules</c> (comma-separated).
/// Single source of truth for parsing, serialising and validating the module set.
/// A2: the console previously echoed the raw comma string as if it were an array.
/// </summary>
public static class ModuleRegistry
{
    // Codes documented on Clinic.ActivatedModules, plus the shipped pharmacy module.
    // D6 finalises which of these become plan entitlements.
    public const string Core = "core";
    public const string Pharmacy = "pharmacy";
    public const string Lab = "lab";
    public const string Inventory = "inventory";
    public const string Finance = "finance";
    public const string Wishlist = "wishlist";
    public const string Emergency = "emergency";
    public const string Precheck = "precheck";
    public const string Notifications = "notifications";
    public const string StaffRoster = "staff_roster";

    public static readonly string[] All =
    [
        Core, Pharmacy, Lab, Inventory, Finance, Wishlist, Emergency, Precheck, Notifications, StaffRoster
    ];

    public static bool IsKnown(string? code) =>
        !string.IsNullOrWhiteSpace(code) &&
        All.Contains(code.Trim().ToLowerInvariant(), StringComparer.Ordinal);

    /// <summary>
    /// Module the tenant must also own before this one is usable. Pharmacy dispensing
    /// reads stock that the inventory module owns, so it cannot stand alone.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string[]> Requires =
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [Pharmacy] = [Inventory]
        };

    /// <summary>True when the tenant owns the module and every module it depends on.</summary>
    public static bool IsEntitled(IReadOnlyCollection<string> entitled, string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return false;

        var normalized = code.Trim().ToLowerInvariant();
        if (!entitled.Contains(normalized))
            return false;

        return !Requires.TryGetValue(normalized, out var dependencies)
            || dependencies.All(entitled.Contains);
    }

    /// <summary>Parses the stored comma-separated value into a normalised, de-duplicated set.</summary>
    public static string[] Parse(string? stored) =>
        Normalize(string.IsNullOrWhiteSpace(stored) ? [] : stored.Split(','));

    /// <summary>Serialises a module set back into the stored comma-separated form.</summary>
    public static string Serialize(IEnumerable<string>? modules) =>
        string.Join(',', Normalize(modules ?? []));

    private static string[] Normalize(IEnumerable<string> modules) =>
        modules
            .Select(m => m.Trim().ToLowerInvariant())
            .Where(m => m.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(m => m, StringComparer.Ordinal)
            .ToArray();
}
