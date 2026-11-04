using System.Text;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Infrastructure.Data;

public record FormularySyncResult(
    int TotalProcessed,
    int AddedCount,
    int UpdatedCount,
    int BatchesAdded,
    string SourcePath
);

public static class HospitalFormularySeeder
{
    public static async Task<FormularySyncResult> SyncFormularyAsync(
        HospitalCrmDbContext db,
        Guid tenantId,
        bool seedBatches = true,
        CancellationToken ct = default)
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "SeedData", "Hospital_Formulary_Master.csv"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Hospital_CRM.Infrastructure", "Data", "SeedData", "Hospital_Formulary_Master.csv"),
            Path.Combine(Directory.GetCurrentDirectory(), "backend", "Hospital_CRM.Infrastructure", "Data", "SeedData", "Hospital_Formulary_Master.csv"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "Hospital_CRM.Infrastructure", "Data", "SeedData", "Hospital_Formulary_Master.csv"),
            @"E:\Company\Hospital Management\Hospital_CRM\backend\Hospital_CRM.Infrastructure\Data\SeedData\Hospital_Formulary_Master.csv"
        };

        string? csvPath = null;
        foreach (var c in candidates)
        {
            try
            {
                var full = Path.GetFullPath(c);
                if (File.Exists(full))
                {
                    csvPath = full;
                    break;
                }
            }
            catch { /* probe error ignore */ }
        }

        if (csvPath == null)
        {
            throw new FileNotFoundException("Hospital_Formulary_Master.csv could not be located in candidate paths.");
        }

        // Ensure a default supplier exists for batch inwarding
        var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);
        if (supplier == null)
        {
            supplier = new Supplier
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "MedSource India Healthcare Pvt Ltd",
                Gstin = "27AABCM8812K1Z0",
                Phone = "+91 98201 12345",
                Email = "orders@medsourceindia.com",
                Address = "Plot 42, MIDC Industrial Area, Andheri East, Mumbai, Maharashtra 400093",
                CreatedAt = DateTimeOffset.UtcNow
            };
            db.Suppliers.Add(supplier);
            await db.SaveChangesAsync(ct);
        }

        var lines = await File.ReadAllLinesAsync(csvPath, Encoding.UTF8, ct);
        var existingDrugs = await db.Drugs
            .Include(d => d.Batches)
            .Where(d => d.TenantId == tenantId)
            .ToListAsync(ct);

        var existingByName = existingDrugs.ToDictionary(d => d.Name.Trim().ToLower(), d => d);

        int totalProcessed = 0;
        int addedCount = 0;
        int updatedCount = 0;
        int batchesAdded = 0;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var newDrugs = new List<Drug>();
        var newBatches = new List<DrugBatch>();

        for (int i = 1; i < lines.Length; i++)
        {
            var line = lines[i];
            if (string.IsNullOrWhiteSpace(line)) continue;

            var parts = ParseCsvLine(line);
            if (parts.Count < 12) continue;

            totalProcessed++;

            var name = parts[0].Trim();
            var genericName = parts[1].Trim();
            var category = parts[2].Trim();
            var dosageForm = parts[3].Trim();
            var strength = parts[4].Trim();
            var schedStr = parts[5].Trim();
            var hsn = parts[6].Trim();
            decimal.TryParse(parts[7].Trim(), out var gstRate);
            var nlem = parts[8].Trim().Equals("Yes", StringComparison.OrdinalIgnoreCase);
            decimal? dpco = decimal.TryParse(parts[9].Trim(), out var dVal) ? dVal : null;
            var packSize = parts[10].Trim();
            decimal.TryParse(parts[11].Trim(), out var indicativeMrp);
            var commonBrands = parts.Count > 12 ? parts[12].Trim() : "";

            Enum.TryParse<ScheduleClass>(schedStr, true, out var schedClass);

            var key = name.ToLower();
            if (existingByName.TryGetValue(key, out var existing))
            {
                // Update verified formulary attributes
                existing.GenericName = genericName;
                existing.TherapeuticCategory = category;
                existing.DosageForm = dosageForm;
                existing.Strength = strength;
                existing.ScheduleClass = schedClass;
                existing.HsnCode = !string.IsNullOrEmpty(hsn) ? hsn : existing.HsnCode;
                existing.GstRate = gstRate > 0 ? gstRate : 12m;
                existing.NlemCovered = nlem;
                if (dpco.HasValue) existing.DpcoCeilingPrice = dpco.Value;
                existing.StandardPackSize = packSize;
                if (indicativeMrp > 0) existing.IndicativeMrp = indicativeMrp;
                existing.CommonBrands = commonBrands;
                existing.DataSource = "HospitalMaster";
                existing.IsUnverified = false;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
                updatedCount++;

                // Ensure at least one active batch if seedBatches is true and no stock remains
                if (seedBatches && !existing.Batches.Any(b => b.ExpiryDate >= today && b.QuantityRemaining > 0))
                {
                    var batch = new DrugBatch
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        DrugId = existing.Id,
                        BatchNumber = $"FORM-{i:D3}-A",
                        ExpiryDate = today.AddMonths(18 + (i % 12)),
                        MfgDate = today.AddMonths(-3),
                        QuantityReceived = 100,
                        QuantityRemaining = 90,
                        Mrp = indicativeMrp > 0 ? indicativeMrp : 75m,
                        PurchaseRate = Math.Round((indicativeMrp > 0 ? indicativeMrp : 75m) * 0.65m, 2),
                        SupplierId = supplier.Id,
                        PackSize = packSize,
                        CreatedAt = DateTimeOffset.UtcNow
                    };
                    newBatches.Add(batch);
                    batchesAdded++;
                }
            }
            else
            {
                var drug = new Drug
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = name,
                    GenericName = genericName,
                    TherapeuticCategory = category,
                    DosageForm = dosageForm,
                    Strength = strength,
                    ScheduleClass = schedClass,
                    HsnCode = !string.IsNullOrEmpty(hsn) ? hsn : "30049099",
                    GstRate = gstRate > 0 ? gstRate : 12m,
                    NlemCovered = nlem,
                    DpcoCeilingPrice = dpco,
                    StandardPackSize = packSize,
                    IndicativeMrp = indicativeMrp,
                    CommonBrands = commonBrands,
                    DataSource = "HospitalMaster",
                    IsUnverified = false,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                newDrugs.Add(drug);
                existingByName[key] = drug;
                addedCount++;

                if (seedBatches)
                {
                    var batchA = new DrugBatch
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        DrugId = drug.Id,
                        BatchNumber = $"FORM-{i:D3}-A",
                        ExpiryDate = today.AddMonths(16 + (i % 12)),
                        MfgDate = today.AddMonths(-4),
                        QuantityReceived = 120,
                        QuantityRemaining = 100,
                        Mrp = indicativeMrp > 0 ? indicativeMrp : 75m,
                        PurchaseRate = Math.Round((indicativeMrp > 0 ? indicativeMrp : 75m) * 0.65m, 2),
                        SupplierId = supplier.Id,
                        PackSize = packSize,
                        CreatedAt = DateTimeOffset.UtcNow
                    };

                    var batchB = new DrugBatch
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        DrugId = drug.Id,
                        BatchNumber = $"FORM-{i:D3}-B",
                        ExpiryDate = today.AddMonths(28 + (i % 8)),
                        MfgDate = today.AddMonths(-1),
                        QuantityReceived = 150,
                        QuantityRemaining = 150,
                        Mrp = indicativeMrp > 0 ? indicativeMrp : 75m,
                        PurchaseRate = Math.Round((indicativeMrp > 0 ? indicativeMrp : 75m) * 0.65m, 2),
                        SupplierId = supplier.Id,
                        PackSize = packSize,
                        CreatedAt = DateTimeOffset.UtcNow
                    };

                    newBatches.Add(batchA);
                    newBatches.Add(batchB);
                    batchesAdded += 2;
                }
            }
        }

        if (newDrugs.Count > 0)
        {
            db.Drugs.AddRange(newDrugs);
        }

        if (newBatches.Count > 0)
        {
            db.DrugBatches.AddRange(newBatches);
        }

        await db.SaveChangesAsync(ct);

        return new FormularySyncResult(
            TotalProcessed: totalProcessed,
            AddedCount: addedCount,
            UpdatedCount: updatedCount,
            BatchesAdded: batchesAdded,
            SourcePath: csvPath
        );
    }

    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var inQuotes = false;
        var current = new StringBuilder();

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }
        result.Add(current.ToString());
        return result;
    }
}

