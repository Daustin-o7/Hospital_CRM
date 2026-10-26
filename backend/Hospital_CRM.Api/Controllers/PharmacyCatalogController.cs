using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/pharmacy")]
[RequireModule(ModuleRegistry.Pharmacy)]
public class PharmacyCatalogController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<PharmacyCatalogController> _logger;

    public PharmacyCatalogController(HospitalCrmDbContext db, ILogger<PharmacyCatalogController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet("drugs")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor", "Receptionist", "Nurse")]
    public async Task<IActionResult> GetDrugs(
        [FromQuery] string? query,
        [FromQuery] string? schedule,
        [FromQuery] string? category,
        [FromQuery] bool? inStockOnly,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var q = _db.Drugs.AsNoTracking().Include(d => d.Batches).AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var cleanQuery = query.Trim().ToLower();
            q = q.Where(d =>
                d.Name.ToLower().Contains(cleanQuery) ||
                d.GenericName.ToLower().Contains(cleanQuery) ||
                (d.CommonBrands != null && d.CommonBrands.ToLower().Contains(cleanQuery)));
        }

        if (!string.IsNullOrWhiteSpace(schedule) && Enum.TryParse<ScheduleClass>(schedule, true, out var schedClass))
        {
            q = q.Where(d => d.ScheduleClass == schedClass);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var cleanCat = category.Trim().ToLower();
            q = q.Where(d => d.TherapeuticCategory.ToLower().Contains(cleanCat));
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var sixtyDaysLater = today.AddDays(60);

        var totalCount = await q.CountAsync(ct);

        var rawDrugs = await q
            .OrderBy(d => d.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var results = rawDrugs.Select(d =>
        {
            var validBatches = d.Batches.Where(b => b.QuantityRemaining > 0 && b.ExpiryDate >= today).ToList();
            var totalStock = validBatches.Sum(b => b.QuantityRemaining);
            var expiringBatchesCount = d.Batches.Count(b => b.QuantityRemaining > 0 && b.ExpiryDate >= today && b.ExpiryDate <= sixtyDaysLater);
            var expiredStock = d.Batches.Where(b => b.QuantityRemaining > 0 && b.ExpiryDate < today).Sum(b => b.QuantityRemaining);

            var nextExpiringBatch = validBatches.OrderBy(b => b.ExpiryDate).FirstOrDefault();

            return new
            {
                id = d.Id,
                name = d.Name,
                genericName = d.GenericName,
                therapeuticCategory = d.TherapeuticCategory,
                dosageForm = d.DosageForm,
                strength = d.Strength,
                scheduleClass = d.ScheduleClass.ToString(),
                hsnCode = d.HsnCode,
                gstRate = d.GstRate,
                nlemCovered = d.NlemCovered,
                dpcoCeilingPrice = d.DpcoCeilingPrice,
                standardPackSize = d.StandardPackSize,
                indicativeMrp = d.IndicativeMrp,
                commonBrands = d.CommonBrands,
                totalStock,
                expiringBatchesCount,
                expiredStock,
                nextExpiringBatch = nextExpiringBatch == null ? null : new
                {
                    batchId = nextExpiringBatch.Id,
                    batchNumber = nextExpiringBatch.BatchNumber,
                    expiryDate = nextExpiringBatch.ExpiryDate.ToString("yyyy-MM-dd"),
                    mrp = nextExpiringBatch.Mrp,
                    quantityRemaining = nextExpiringBatch.QuantityRemaining
                }
            };
        }).Where(d => inStockOnly != true || d.totalStock > 0).ToList();

        return Ok(new
        {
            total = totalCount,
            page,
            pageSize,
            drugs = results
        });
    }

    [HttpGet("drugs/export")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor")]
    public async Task ExportDrugsCsv(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        Response.ContentType = "text/csv";
        Response.Headers.ContentDisposition = $"attachment; filename=\"samstack_drug_catalog_{DateTime.UtcNow:yyyyMMdd}.csv\"";

        await using var writer = new StreamWriter(Response.Body, Encoding.UTF8, 8192, leaveOpen: true);

        // Write header
        await writer.WriteLineAsync("Id,DrugName,GenericComposition,TherapeuticCategory,DosageForm,Strength,ScheduleClass,HSN,GSTRate,NLEM,DPCO_Ceiling,PackSize,CurrentStock,IndicativeMRP,CommonBrands");
        await writer.FlushAsync(ct);

        // Stream drugs in batches to avoid OOM
        const int batchSize = 500;
        int skip = 0;
        bool hasMore = true;

        while (hasMore && !ct.IsCancellationRequested)
        {
            var drugs = await _db.Drugs.AsNoTracking()
                .Include(d => d.Batches)
                .OrderBy(d => d.Name)
                .Skip(skip)
                .Take(batchSize)
                .ToListAsync(ct);

            if (drugs.Count == 0)
            {
                hasMore = false;
                break;
            }

            foreach (var d in drugs)
            {
                var stock = d.Batches.Where(b => b.ExpiryDate >= today).Sum(b => b.QuantityRemaining);
                var dpco = d.DpcoCeilingPrice?.ToString("F2") ?? string.Empty;
                var brands = PharmacyCommon.EscapeCsv(d.CommonBrands ?? string.Empty);
                var nlem = d.NlemCovered ? "Yes" : "No";
                var line = string.Format("\"{0}\",\"{1}\",\"{2}\",\"{3}\",\"{4}\",\"{5}\",\"{6}\",\"{7}\",{8},\"{9}\",{10},\"{11}\",{12},{13:F2},\"{14}\"",
                    d.Id, PharmacyCommon.EscapeCsv(d.Name), PharmacyCommon.EscapeCsv(d.GenericName), PharmacyCommon.EscapeCsv(d.TherapeuticCategory),
                    d.DosageForm, d.Strength, d.ScheduleClass, d.HsnCode, d.GstRate, nlem, dpco,
                    d.StandardPackSize, stock, d.IndicativeMrp, brands);
                await writer.WriteLineAsync(line);
            }

            await writer.FlushAsync(ct);
            skip += batchSize;
        }
    }

    [HttpGet("drugs/{id:guid}")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor", "Receptionist", "Nurse")]
    public async Task<IActionResult> GetDrugById(Guid id, CancellationToken ct)
    {
        var drug = await _db.Drugs.AsNoTracking()
            .Include(d => d.Batches)
                .ThenInclude(b => b.Supplier)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (drug == null)
            return NotFound(new { error = "drug_not_found" });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return Ok(new
        {
            id = drug.Id,
            name = drug.Name,
            genericName = drug.GenericName,
            therapeuticCategory = drug.TherapeuticCategory,
            dosageForm = drug.DosageForm,
            strength = drug.Strength,
            scheduleClass = drug.ScheduleClass.ToString(),
            hsnCode = drug.HsnCode,
            gstRate = drug.GstRate,
            nlemCovered = drug.NlemCovered,
            dpcoCeilingPrice = drug.DpcoCeilingPrice,
            standardPackSize = drug.StandardPackSize,
            indicativeMrp = drug.IndicativeMrp,
            commonBrands = drug.CommonBrands,
            batches = drug.Batches.OrderBy(b => b.ExpiryDate).Select(b => new
            {
                id = b.Id,
                batchNumber = b.BatchNumber,
                expiryDate = b.ExpiryDate.ToString("yyyy-MM-dd"),
                mfgDate = b.MfgDate?.ToString("yyyy-MM-dd"),
                quantityReceived = b.QuantityReceived,
                quantityRemaining = b.QuantityRemaining,
                mrp = b.Mrp,
                purchaseRate = b.PurchaseRate,
                supplierName = b.Supplier?.Name,
                isExpired = b.ExpiryDate < today,
                isNearExpiry = b.ExpiryDate >= today && b.ExpiryDate <= today.AddDays(60)
            })
        });
    }

    [HttpPost("drugs")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist")]
    public async Task<IActionResult> CreateDrug([FromBody] CreateDrugRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.GenericName))
            return BadRequest(new { error = "name_and_generic_required" });

        // SEC-007: Reject invalid ScheduleClass instead of silently defaulting to General.
        var schedule = ScheduleClass.General;
        if (!string.IsNullOrWhiteSpace(req.ScheduleClass))
        {
            if (!Enum.TryParse(req.ScheduleClass, true, out schedule))
                return BadRequest(new { error = "invalid_schedule_class", message = $"'{req.ScheduleClass}' is not a valid ScheduleClass. Valid values: {string.Join(", ", Enum.GetNames<ScheduleClass>())}" });
        }

        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            TenantId = User.GetTenantId() ?? Guid.Empty,
            Name = req.Name.Trim(),
            GenericName = req.GenericName.Trim(),
            TherapeuticCategory = req.TherapeuticCategory?.Trim() ?? "General",
            DosageForm = req.DosageForm?.Trim() ?? "Tablet",
            Strength = req.Strength?.Trim() ?? "",
            ScheduleClass = schedule,
            HsnCode = string.IsNullOrWhiteSpace(req.HsnCode) ? "30049099" : req.HsnCode.Trim(),
            GstRate = req.GstRate > 0 ? req.GstRate : 12m,
            NlemCovered = req.NlemCovered,
            DpcoCeilingPrice = req.DpcoCeilingPrice,
            StandardPackSize = req.StandardPackSize?.Trim() ?? "10 Tablets",
            IndicativeMrp = req.IndicativeMrp,
            CommonBrands = req.CommonBrands?.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.Drugs.Add(drug);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new { id = drug.Id, message = "drug_created" });
    }

    [HttpGet("substitutes/{drugId:guid}")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor", "Receptionist", "Nurse")]
    public async Task<IActionResult> GetGenericSubstitutes(Guid drugId, CancellationToken ct)
    {
        var drug = await _db.Drugs.AsNoTracking().FirstOrDefaultAsync(d => d.Id == drugId, ct);
        if (drug == null)
            return NotFound(new { error = "drug_not_found" });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Same generic, strength and form only: "Paracetamol" must not suggest
        // "Paracetamol + Codeine", and out-of-stock/recalled alternatives are noise.
        var generic = drug.GenericName.Trim().ToLower();
        var strength = drug.Strength.Trim().ToLower();
        var form = drug.DosageForm.Trim().ToLower();

        var substitutes = await _db.Drugs.AsNoTracking()
            .Include(d => d.Batches)
            .Where(d => d.Id != drugId
                && d.GenericName.ToLower() == generic
                && d.Strength.ToLower() == strength
                && d.DosageForm.ToLower() == form
                && d.Batches.Any(b => b.QuantityRemaining > 0 && b.ExpiryDate >= today && !b.IsRecalled))
            .ToListAsync(ct);

        var results = substitutes.Select(d =>
        {
            var validBatches = d.Batches
                .Where(b => b.QuantityRemaining > 0 && b.ExpiryDate >= today && !b.IsRecalled)
                .ToList();
            var totalStock = validBatches.Sum(b => b.QuantityRemaining);
            var bestBatch = validBatches.OrderBy(b => b.ExpiryDate).FirstOrDefault();

            return new
            {
                id = d.Id,
                name = d.Name,
                genericName = d.GenericName,
                therapeuticCategory = d.TherapeuticCategory,
                dosageForm = d.DosageForm,
                strength = d.Strength,
                scheduleClass = d.ScheduleClass.ToString(),
                indicativeMrp = d.IndicativeMrp,
                totalStock,
                inStock = totalStock > 0,
                commonBrands = d.CommonBrands,
                activeBatch = bestBatch == null ? null : new
                {
                    batchId = bestBatch.Id,
                    batchNumber = bestBatch.BatchNumber,
                    expiryDate = bestBatch.ExpiryDate.ToString("yyyy-MM-dd"),
                    mrp = bestBatch.Mrp,
                    quantityRemaining = bestBatch.QuantityRemaining
                }
            };
        }).OrderByDescending(s => s.inStock).ThenBy(s => s.indicativeMrp).ToList();

        return Ok(new
        {
            originalDrug = new
            {
                id = drug.Id,
                name = drug.Name,
                genericName = drug.GenericName,
                strength = drug.Strength
            },
            substitutes = results
        });
    }
}
