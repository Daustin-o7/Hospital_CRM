using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Typesense;

namespace Hospital_CRM.Api.Services.Typesense;

public interface IPatientSearchService
{
    Task IndexAsync(Patient patient, CancellationToken ct);
    Task IndexManyAsync(IEnumerable<Patient> patients, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<List<PatientSearchHit>> SearchAsync(string query, Guid tenantId, int limit = 10, CancellationToken ct = default);
    Task<List<PatientSearchHit>> CheckDuplicatesAsync(string name, string? phone, DateOnly? dob, Guid tenantId, CancellationToken ct = default);
    Task EnsureCollectionAsync(CancellationToken ct);
}

public record PatientSearchHit(
    Guid Id,
    string Name,
    string Phone,
    string? Dob,
    string? Gender,
    string? Address,
    int Score);

/// <summary>
/// Patient search via self-hosted Typesense with automatic PostgreSQL fallback.
/// Write-through is fire-and-forget inside try/catch so a Typesense outage never blocks clinical writes.
/// Nightly Hangfire reindex is the repair mechanism for silent failures.
/// </summary>
public class PatientSearchService : IPatientSearchService
{
    private readonly ITypesenseClient _ts;
    private readonly TypesenseOptions _opts;
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<PatientSearchService> _log;

    public PatientSearchService(
        ITypesenseClientFactory factory,
        IOptions<TypesenseOptions> opts,
        HospitalCrmDbContext db,
        ILogger<PatientSearchService> log)
    {
        _ts = factory.Create();
        _opts = opts.Value;
        _db = db;
        _log = log;
    }

    public async Task EnsureCollectionAsync(CancellationToken ct)
    {
        try
        {
            await _ts.RetrieveCollection(_opts.PatientsCollection, ct);
        }
        catch (TypesenseApiNotFoundException)
        {
            var fields = new List<Field>
            {
                new Field("id", FieldType.String),
                new Field("tenant_id", FieldType.String) { Facet = true },
                new Field("name", FieldType.String) { Sort = true },
                new Field("phone", FieldType.String),
                new Field("dob", FieldType.String) { Optional = true },
                new Field("gender", FieldType.String) { Optional = true },
                new Field("address", FieldType.String) { Optional = true },
                new Field("email", FieldType.String) { Optional = true },
                new Field("created_at", FieldType.Int64)
            };
            var schema = new Schema(_opts.PatientsCollection, fields, "created_at");
            await _ts.CreateCollection(schema);
            _log.LogInformation("Created Typesense collection {Collection}", _opts.PatientsCollection);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Typesense EnsureCollectionAsync failed. Typesense service may be offline or starting up.");
        }
    }

    public async Task IndexAsync(Patient patient, CancellationToken ct)
    {
        var doc = ToDocument(patient);
        try
        {
            await _ts.UpsertDocument<TypesensePatientDocument>(_opts.PatientsCollection, doc);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Typesense index failed for patient {Id}; nightly reindex will reconcile", patient.Id);
        }
    }

    public async Task IndexManyAsync(IEnumerable<Patient> patients, CancellationToken ct)
    {
        var docs = patients.Select(ToDocument).ToList();
        if (docs.Count == 0) return;

        const int batchSize = 1000;
        for (var i = 0; i < docs.Count; i += batchSize)
        {
            var batch = docs.Skip(i).Take(batchSize);
            try
            {
                var importResponse = await _ts.ImportDocuments<TypesensePatientDocument>(
                    _opts.PatientsCollection,
                    batch,
                    batchSize,
                    ImportType.Upsert);

                var failed = importResponse.Where(r => !r.Success).ToList();
                if (failed.Count > 0)
                {
                    _log.LogWarning("Typesense bulk import: {Failed}/{Total} documents failed",
                        failed.Count, importResponse.Count);
                }
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Typesense bulk import batch failed");
            }
        }
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        try
        {
            await _ts.DeleteDocument<TypesensePatientDocument>(_opts.PatientsCollection, id.ToString());
        }
        catch (TypesenseApiNotFoundException)
        {
            // already gone — fine
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Typesense delete failed for patient {Id}", id);
        }
    }

    public async Task<List<PatientSearchHit>> SearchAsync(string query, Guid tenantId, int limit = 10, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query))
            return new List<PatientSearchHit>();

        var trimmed = query.Trim();
        var isNumeric = trimmed.All(char.IsDigit) && trimmed.Length >= 3;
        var sp = new SearchParameters(trimmed, isNumeric ? "phone,name" : "name,phone")
        {
            Prefix = true,
            FilterBy = $"tenant_id:={tenantId}",
            PerPage = limit,
            NumberOfTypos = isNumeric ? "0" : "2"
        };

        try
        {
            var result = await _ts.Search<TypesensePatientDocument>(_opts.PatientsCollection, sp, ct);
            return result.Hits.Select(h => new PatientSearchHit(
                Guid.Parse(h.Document.Id),
                h.Document.Name,
                h.Document.Phone,
                h.Document.Dob,
                h.Document.Gender,
                h.Document.Address,
                (int)(h.TextMatch ?? 0))).ToList();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Typesense search unavailable; executing PostgreSQL fallback search for query {Query}", query);
            return await FallbackSearchDatabaseAsync(trimmed, tenantId, limit, ct);
        }
    }

    public async Task<List<PatientSearchHit>> CheckDuplicatesAsync(string name, string? phone, DateOnly? dob, Guid tenantId, CancellationToken ct = default)
    {
        var parts = new List<string> { name };
        if (!string.IsNullOrWhiteSpace(phone)) parts.Add(phone);
        if (dob.HasValue) parts.Add(dob.Value.ToString("yyyy-MM-dd"));

        var composite = string.Join(" ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        if (string.IsNullOrWhiteSpace(composite)) return new List<PatientSearchHit>();

        var sp = new SearchParameters(composite, "name,phone,dob")
        {
            Prefix = true,
            FilterBy = $"tenant_id:={tenantId}",
            PerPage = 5,
            NumberOfTypos = "1"
        };

        try
        {
            var result = await _ts.Search<TypesensePatientDocument>(_opts.PatientsCollection, sp, ct);
            return result.Hits
                .Where(h => (h.TextMatch ?? 0) > 100)
                .Select(h => new PatientSearchHit(
                    Guid.Parse(h.Document.Id),
                    h.Document.Name,
                    h.Document.Phone,
                    h.Document.Dob,
                    h.Document.Gender,
                    h.Document.Address,
                    (int)(h.TextMatch ?? 0)))
                .ToList();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Typesense duplicate check unavailable; executing PostgreSQL fallback for {Name}", name);
            return await FallbackDuplicateCheckDatabaseAsync(name, phone, dob, tenantId, ct);
        }
    }

    private async Task<List<PatientSearchHit>> FallbackSearchDatabaseAsync(string query, Guid tenantId, int limit, CancellationToken ct)
    {
        try
        {
            var matches = await _db.Patients.AsNoTracking()
                .Where(p => EF.Functions.ILike(p.Name, $"%{query}%") || EF.Functions.ILike(p.Phone, $"%{query}%"))
                .OrderByDescending(p => p.CreatedAt)
                .Take(limit)
                .ToListAsync(ct);

            return matches.Select(p => new PatientSearchHit(
                p.Id,
                p.Name,
                p.Phone,
                p.Dob?.ToString("yyyy-MM-dd"),
                p.Gender.ToString(),
                p.Address,
                100)).ToList();
        }
        catch (Exception dbEx)
        {
            _log.LogError(dbEx, "Database fallback search failed for query {Query}", query);
            return new List<PatientSearchHit>();
        }
    }

    private async Task<List<PatientSearchHit>> FallbackDuplicateCheckDatabaseAsync(string name, string? phone, DateOnly? dob, Guid tenantId, CancellationToken ct)
    {
        try
        {
            var query = _db.Patients.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(phone))
            {
                var phoneMatches = await query
                    .Where(p => p.Phone == phone)
                    .Take(5)
                    .ToListAsync(ct);

                if (phoneMatches.Count > 0)
                {
                    return phoneMatches.Select(p => new PatientSearchHit(
                        p.Id,
                        p.Name,
                        p.Phone,
                        p.Dob?.ToString("yyyy-MM-dd"),
                        p.Gender.ToString(),
                        p.Address,
                        150)).ToList();
                }
            }

            var nameDobMatches = await query
                .Where(p => EF.Functions.ILike(p.Name, $"%{name}%") && (dob == null || p.Dob == dob))
                .Take(5)
                .ToListAsync(ct);

            return nameDobMatches.Select(p => new PatientSearchHit(
                p.Id,
                p.Name,
                p.Phone,
                p.Dob?.ToString("yyyy-MM-dd"),
                p.Gender.ToString(),
                p.Address,
                110)).ToList();
        }
        catch (Exception dbEx)
        {
            _log.LogError(dbEx, "Database fallback duplicate check failed for name {Name}", name);
            return new List<PatientSearchHit>();
        }
    }

    private static TypesensePatientDocument ToDocument(Patient p) => new()
    {
        Id = p.Id.ToString(),
        TenantId = p.TenantId.ToString(),
        Name = p.Name,
        Phone = p.Phone,
        Dob = p.Dob?.ToString("yyyy-MM-dd"),
        Gender = p.Gender.ToString(),
        Address = p.Address,
        Email = null,
        CreatedAt = p.CreatedAt.ToUnixTimeSeconds()
    };
}