using System.Security.Cryptography;
using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Api.Services.Typesense;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class MedicinesController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IPatientSearchService _search;
    private readonly ICdciMedicineCatalogService _cdci;
    private readonly ILogger<MedicinesController> _logger;

    public MedicinesController(
        HospitalCrmDbContext db,
        IPatientSearchService search,
        ICdciMedicineCatalogService cdci,
        ILogger<MedicinesController> logger)
    {
        _db = db;
        _search = search;
        _cdci = cdci;
        _logger = logger;
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] int limit = 10, CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var tenantId = User.GetTenantId() ?? Guid.Empty;

        if (string.IsNullOrWhiteSpace(q))
            return Ok(Array.Empty<object>());

        var cleanQuery = q.Trim();
        var maxLimit = Math.Clamp(limit, 1, 50);

        // 1. Primary search: Local clinic inventory / Hospital Master
        var hits = await _search.MedicinesSearchAsync(cleanQuery, tenantId, maxLimit, ct);

        // Fetch corresponding DB records to preserve verified schedule, datasource, etc.
        var hitIds = hits.Select(h => h.Id).ToList();
        var dbDrugs = await _db.Drugs.AsNoTracking()
            .Where(d => hitIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, ct);

        var results = new List<object>();

        foreach (var h in hits)
        {
            dbDrugs.TryGetValue(h.Id, out var drug);
            results.Add(new
            {
                id = h.Id,
                name = h.Name,
                genericName = h.GenericName,
                commonBrands = h.CommonBrands,
                strength = h.Strength,
                dosageForm = h.DosageForm,
                scheduleClass = drug?.ScheduleClass.ToString(),
                dataSource = drug?.DataSource ?? "HospitalMaster",
                isUnverified = drug?.IsUnverified ?? false,
                checkpointMessage = (drug?.IsUnverified ?? false) ? "Open Source - Needs Pharmacist Review" : null,
                indicativeMrp = drug?.IndicativeMrp ?? 0m,
                gstRate = drug?.GstRate ?? 12m,
                hsnCode = drug?.HsnCode,
                score = h.Score
            });
        }

        // 2. Secondary fallback / enrichment: CDCI Open-Source Database
        if (results.Count < maxLimit)
        {
            var needed = maxLimit - results.Count;
            var cdciHits = await _cdci.SearchAsync(cleanQuery, needed, ct);

            foreach (var cdci in cdciHits)
            {
                // Avoid duplicates if already present in results by name
                var alreadyPresent = results.Any(r =>
                {
                    var prop = r.GetType().GetProperty("name")?.GetValue(r) as string;
                    return string.Equals(prop, cdci.Name, StringComparison.OrdinalIgnoreCase);
                });

                if (alreadyPresent) continue;

                results.Add(new
                {
                    id = CreateDeterministicGuid("cdci:" + cdci.ExternalCode),
                    name = cdci.Name,
                    genericName = cdci.GenericName,
                    commonBrands = cdci.CommonBrands,
                    strength = cdci.Strength,
                    dosageForm = cdci.DosageForm,
                    scheduleClass = (string?)null, // CDCI release notes do not supply schedule class
                    dataSource = "CDCI (Open Source)",
                    isUnverified = true, // Checkpoint: explicitly unverified open-source entry
                    checkpointMessage = "Open Source - Needs Pharmacist Review",
                    indicativeMrp = 0m, // Must be configured by pharmacist
                    gstRate = 12m,
                    hsnCode = (string?)null,
                    score = 80
                });
            }
        }

        // 3. Log autocomplete miss if 0 hits across all sources
        if (results.Count == 0)
        {
            try
            {
                _db.MedicineSearchMissLogs.Add(new MedicineSearchMissLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Query = cleanQuery,
                    SearchedByUserId = userId.Value,
                    SearchedAt = DateTimeOffset.UtcNow
                });
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to record medicine search miss log for {Query}", cleanQuery);
            }
        }

        return Ok(results);
    }

    [HttpPost("curate-from-source")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist")]
    public async Task<IActionResult> CurateMedicineFromSource([FromBody] CurateMedicineRequest req, CancellationToken ct)
    {
        var tenantId = User.GetTenantId() ?? Guid.Empty;

        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.GenericName))
            return BadRequest(new { error = "name_and_generic_required" });

        var schedule = ScheduleClass.General;
        if (!string.IsNullOrWhiteSpace(req.ScheduleClass) && Enum.TryParse<ScheduleClass>(req.ScheduleClass, true, out var parsedSched))
        {
            schedule = parsedSched;
        }

        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = req.Name.Trim(),
            GenericName = req.GenericName.Trim(),
            TherapeuticCategory = req.TherapeuticCategory,
            DosageForm = req.DosageForm,
            Strength = req.Strength,
            ScheduleClass = schedule,
            HsnCode = req.HsnCode,
            GstRate = req.GstRate > 0 ? req.GstRate : 12m,
            IndicativeMrp = req.IndicativeMrp,
            StandardPackSize = req.StandardPackSize ?? "10 Tablets",
            CommonBrands = req.CommonBrands ?? req.Name.Trim(),
            ExternalCode = req.ExternalCode,
            DataSource = "HospitalMaster", // Promoted and verified by clinic pharmacist
            IsUnverified = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.Drugs.Add(drug);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = drug.Id,
            name = drug.Name,
            genericName = drug.GenericName,
            scheduleClass = drug.ScheduleClass.ToString(),
            dataSource = drug.DataSource,
            isUnverified = drug.IsUnverified,
            message = "medicine_curated_and_verified"
        });
    }

    [HttpGet("miss-logs")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist")]
    public async Task<IActionResult> GetSearchMissLogs([FromQuery] int limit = 50, CancellationToken ct = default)
    {
        var tenantId = User.GetTenantId() ?? Guid.Empty;

        var misses = await _db.MedicineSearchMissLogs.AsNoTracking()
            .Where(m => tenantId == Guid.Empty || m.TenantId == tenantId)
            .OrderByDescending(m => m.SearchedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .Select(m => new
            {
                id = m.Id,
                query = m.Query,
                timestamp = m.SearchedAt,
                searchedBy = m.SearchedByUserId
            })
            .ToListAsync(ct);

        return Ok(misses);
    }

    private static Guid CreateDeterministicGuid(string input)
    {
        using var md5 = MD5.Create();
        var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(input));
        return new Guid(hash);
    }
}

public record CurateMedicineRequest(
    string Name,
    string GenericName,
    string? TherapeuticCategory,
    string? DosageForm,
    string? Strength,
    string? ScheduleClass,
    string? HsnCode,
    decimal GstRate,
    decimal IndicativeMrp,
    string? StandardPackSize,
    string? CommonBrands,
    string? ExternalCode
);