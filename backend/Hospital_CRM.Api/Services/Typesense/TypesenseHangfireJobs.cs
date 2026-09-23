using Hangfire;
using Hospital_CRM.Api.Services.Typesense;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Typesense;

namespace Hospital_CRM.Api.Services.Typesense;

public interface ITypesenseHangfireJobs
{
    Task ReindexTypesenseAsync(CancellationToken ct = default);
    Task ReindexMedicinesTypesenseAsync(CancellationToken ct = default);
}

/// <summary>
/// Hangfire job for Typesense background maintenance and reconciliation.
/// Injected via DI by Hangfire AspNetCoreJobActivator.
/// </summary>
public class TypesenseHangfireJobs : ITypesenseHangfireJobs
{
    private readonly HospitalCrmDbContext _db;
    private readonly IPatientSearchService _search;
    private readonly ILogger<TypesenseHangfireJobs> _log;

    public TypesenseHangfireJobs(
        HospitalCrmDbContext db,
        IPatientSearchService search,
        ILogger<TypesenseHangfireJobs> log)
    {
        _db = db;
        _search = search;
        _log = log;
    }

    public async Task ReindexTypesenseAsync(CancellationToken ct = default)
    {
        _log.LogInformation("Starting nightly Typesense patient reindexing...");
        try
        {
            var patients = await _db.Patients.AsNoTracking().ToListAsync(ct);
            await _search.IndexManyAsync(patients, ct);
            _log.LogInformation("Typesense patient reindexing completed successfully for {Count} patients", patients.Count);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to reindex patients in Typesense");
            throw;
        }
    }

    public async Task ReindexMedicinesTypesenseAsync(CancellationToken ct = default)
    {
        _log.LogInformation("Starting nightly Typesense medicine reindexing...");
        try
        {
            var drugs = await _db.Drugs.AsNoTracking().ToListAsync(ct);
            await _search.IndexManyMedicinesAsync(drugs, ct);
            _log.LogInformation("Typesense medicine reindexing completed successfully for {Count} medicines", drugs.Count);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to reindex medicines in Typesense");
            throw;
        }
    }
}