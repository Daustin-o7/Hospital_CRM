using System.Security.Cryptography;
using System.Text;

namespace Hospital_CRM.Api.Services;

public record CdciMedicineSearchResult(
    string ExternalCode,
    string Name,
    string? GenericName,
    string? DosageForm,
    string? Strength,
    string? CommonBrands,
    string DataSource = "CDCI (Open Source)",
    bool IsUnverified = true,
    string CheckpointMessage = "Open Source - Needs Pharmacist Review"
);

public interface ICdciMedicineCatalogService
{
    Task<List<CdciMedicineSearchResult>> SearchAsync(string query, int limit = 20, CancellationToken ct = default);
}

public class CdciMedicineCatalogService : ICdciMedicineCatalogService
{
    private readonly ILogger<CdciMedicineCatalogService> _logger;
    private readonly IConfiguration _config;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private bool _initialized;

    // Cache generic code -> generic name & dose form
    private readonly Dictionary<string, (string GenericName, string? DoseForm)> _generics = new(StringComparer.OrdinalIgnoreCase);
    // Cache searchable list of generics
    private readonly List<(string Code, string GenericName, string? DoseForm)> _genericList = new();
    // Cache brands: Code, BrandName, GenericCode
    private readonly List<(string Code, string BrandName, string GenericCode)> _brandList = new();

    public CdciMedicineCatalogService(ILogger<CdciMedicineCatalogService> logger, IConfiguration config)
    {
        _logger = logger;
        _config = config;
    }

    private async Task EnsureLoadedAsync(CancellationToken ct)
    {
        if (_initialized) return;

        await _initLock.WaitAsync(ct);
        try
        {
            if (_initialized) return;

            var basePath = ResolveDataPath();
            if (basePath == null)
            {
                _logger.LogWarning("CDCI flat file package directory not found. CDCI catalog search will return empty results.");
                _initialized = true;
                return;
            }

            var genericPath = Path.Combine(basePath, "GenericMaster.txt");
            var brandPath = Path.Combine(basePath, "BrandMaster.txt");

            if (File.Exists(genericPath))
            {
                using var reader = new StreamReader(genericPath, Encoding.UTF8);
                string? line;
                bool isHeader = true;
                while ((line = await reader.ReadLineAsync(ct)) != null)
                {
                    if (isHeader) { isHeader = false; continue; }
                    var parts = line.Split('\t');
                    if (parts.Length < 2) continue;

                    var id = parts[0].Trim();
                    var genericName = parts[1].Trim();
                    var doseForm = parts.Length > 4 ? parts[4].Trim() : null;

                    _generics[id] = (genericName, doseForm);
                    _genericList.Add((id, genericName, doseForm));
                }
                _logger.LogInformation("Loaded {Count} generic drugs from CDCI GenericMaster.txt", _genericList.Count);
            }

            if (File.Exists(brandPath))
            {
                using var reader = new StreamReader(brandPath, Encoding.UTF8);
                string? line;
                bool isHeader = true;
                while ((line = await reader.ReadLineAsync(ct)) != null)
                {
                    if (isHeader) { isHeader = false; continue; }
                    var parts = line.Split('\t');
                    if (parts.Length < 5) continue;

                    var brandId = parts[0].Trim();
                    var brandName = parts[1].Trim();
                    var genericId = parts[4].Trim();

                    _brandList.Add((brandId, brandName, genericId));
                }
                _logger.LogInformation("Loaded {Count} brands from CDCI BrandMaster.txt", _brandList.Count);
            }

            _initialized = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load CDCI flat file package.");
            _initialized = true;
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async Task<List<CdciMedicineSearchResult>> SearchAsync(string query, int limit = 20, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query))
            return new List<CdciMedicineSearchResult>();

        await EnsureLoadedAsync(ct);

        var trimmed = query.Trim();
        var results = new List<CdciMedicineSearchResult>();
        var seenCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // 1. Search brand names
        for (int i = 0; i < _brandList.Count && results.Count < limit; i++)
        {
            var (brandCode, brandName, genericCode) = _brandList[i];
            if (brandName.Contains(trimmed, StringComparison.OrdinalIgnoreCase))
            {
                if (seenCodes.Add(brandCode))
                {
                    _generics.TryGetValue(genericCode, out var gen);
                    results.Add(new CdciMedicineSearchResult(
                        ExternalCode: brandCode,
                        Name: brandName,
                        GenericName: gen.GenericName ?? "Unknown Generic",
                        DosageForm: gen.DoseForm,
                        Strength: ExtractStrength(brandName),
                        CommonBrands: brandName,
                        DataSource: "CDCI (Open Source)",
                        IsUnverified: true,
                        CheckpointMessage: "Open Source - Needs Pharmacist Review"
                    ));
                }
            }
        }

        // 2. If limit not reached, search generic names
        if (results.Count < limit)
        {
            for (int i = 0; i < _genericList.Count && results.Count < limit; i++)
            {
                var (genericCode, genericName, doseForm) = _genericList[i];
                if (genericName.Contains(trimmed, StringComparison.OrdinalIgnoreCase))
                {
                    if (seenCodes.Add(genericCode))
                    {
                        results.Add(new CdciMedicineSearchResult(
                            ExternalCode: genericCode,
                            Name: genericName,
                            GenericName: genericName,
                            DosageForm: doseForm,
                            Strength: ExtractStrength(genericName),
                            CommonBrands: null,
                            DataSource: "CDCI (Open Source)",
                            IsUnverified: true,
                            CheckpointMessage: "Open Source - Needs Pharmacist Review"
                        ));
                    }
                }
            }
        }

        return results;
    }

    private string? ResolveDataPath()
    {
        var configured = _config["CdciDataPath"];
        if (!string.IsNullOrWhiteSpace(configured) && Directory.Exists(configured))
            return configured;

        // Candidate paths relative to working directory and execution base
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Medicine", "CommonDrugCodesForIndia_FlatFilePackage"),
            Path.Combine(AppContext.BaseDirectory, "../../../../Medicine/CommonDrugCodesForIndia_FlatFilePackage"),
            Path.Combine(Directory.GetCurrentDirectory(), "Medicine", "CommonDrugCodesForIndia_FlatFilePackage"),
            Path.Combine(Directory.GetCurrentDirectory(), "../../Medicine/CommonDrugCodesForIndia_FlatFilePackage"),
            Path.Combine(Directory.GetCurrentDirectory(), "../Medicine/CommonDrugCodesForIndia_FlatFilePackage"),
            @"E:\Company\Hospital Management\Hospital_CRM\Medicine\CommonDrugCodesForIndia_FlatFilePackage"
        };

        foreach (var candidate in candidates)
        {
            try
            {
                var full = Path.GetFullPath(candidate);
                if (Directory.Exists(full))
                {
                    return full;
                }
            }
            catch
            {
                // Ignore path format errors during probe
            }
        }

        return null;
    }

    private static string? ExtractStrength(string text)
    {
        // Simple regex / string scan for typical dosage numbers (e.g. "500 mg", "10 mg/mL", "50 mcg")
        var match = System.Text.RegularExpressions.Regex.Match(text, @"\b\d+(\.\d+)?\s*(mg|mcg|microgram|g|ml|mg/ml|IU|unit)\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success ? match.Value : null;
    }
}
