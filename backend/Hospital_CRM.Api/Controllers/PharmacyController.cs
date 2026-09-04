using System.Data;
using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/pharmacy")]
public class PharmacyController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<PharmacyController> _logger;

    public PharmacyController(HospitalCrmDbContext db, ILogger<PharmacyController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ==========================================
    // 1. DRUG CATALOG & SEARCH
    // ==========================================

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
                activeBatchesCount = validBatches.Count,
                expiringBatchesCount,
                expiredStock,
                earliestBatch = nextExpiringBatch == null ? null : new
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
    public async Task<IActionResult> ExportDrugsCsv(CancellationToken ct)
    {
        var drugs = await _db.Drugs.AsNoTracking()
            .Include(d => d.Batches)
            .OrderBy(d => d.Name)
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var sb = new StringBuilder();
        sb.AppendLine("Id,DrugName,GenericComposition,TherapeuticCategory,DosageForm,Strength,ScheduleClass,HSN,GSTRate,NLEM,DPCO_Ceiling,PackSize,CurrentStock,IndicativeMRP,CommonBrands");

        foreach (var d in drugs)
        {
            var stock = d.Batches.Where(b => b.ExpiryDate >= today).Sum(b => b.QuantityRemaining);
            sb.AppendLine($"\"{d.Id}\",\"{EscapeCsv(d.Name)}\",\"{EscapeCsv(d.GenericName)}\",\"{EscapeCsv(d.TherapeuticCategory)}\",\"{d.DosageForm}\",\"{d.Strength}\",\"{d.ScheduleClass}\",\"{d.HsnCode}\",{d.GstRate},\"{(d.NlemCovered ? "Yes" : "No")}\",{d.DpcoCeilingPrice?.ToString("F2") ?? ""},\"{d.StandardPackSize}\",{stock},{d.IndicativeMrp:F2},\"{EscapeCsv(d.CommonBrands ?? "")}\"");
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"samstack_drug_catalog_{DateTime.UtcNow:yyyyMMdd}.csv");
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

        var schedule = ScheduleClass.General;
        if (!string.IsNullOrWhiteSpace(req.ScheduleClass))
        {
            Enum.TryParse(req.ScheduleClass, true, out schedule);
        }

        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
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

    // ==========================================
    // 2. FEFO BATCHES & STOCK INWARDING
    // ==========================================

    [HttpGet("drugs/{id:guid}/batches/fefo")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor", "Receptionist", "Nurse")]
    public async Task<IActionResult> GetFefoBatches(Guid id, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var batches = await _db.DrugBatches.AsNoTracking()
            .Where(b => b.DrugId == id && b.QuantityRemaining > 0 && b.ExpiryDate >= today)
            .OrderBy(b => b.ExpiryDate) // FEFO: First Expiry First Out
            .Select(b => new
            {
                id = b.Id,
                batchNumber = b.BatchNumber,
                expiryDate = b.ExpiryDate.ToString("yyyy-MM-dd"),
                quantityRemaining = b.QuantityRemaining,
                mrp = b.Mrp,
                purchaseRate = b.PurchaseRate
            })
            .ToListAsync(ct);

        return Ok(batches);
    }

    [HttpGet("drugs/{id:guid}/fefo-batch")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor", "Receptionist", "Nurse")]
    public async Task<IActionResult> GetSingleFefoBatch(Guid id, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var batch = await _db.DrugBatches.AsNoTracking()
            .Where(b => b.DrugId == id && b.QuantityRemaining > 0 && b.ExpiryDate >= today)
            .OrderBy(b => b.ExpiryDate)
            .Select(b => new
            {
                id = b.Id,
                batchId = b.Id,
                batchNumber = b.BatchNumber,
                expiryDate = b.ExpiryDate.ToString("yyyy-MM-dd"),
                quantityRemaining = b.QuantityRemaining,
                mrp = b.Mrp,
                purchaseRate = b.PurchaseRate
            })
            .FirstOrDefaultAsync(ct);

        if (batch == null)
            return NotFound(new { error = "no_active_batch_in_stock", message = "No active batch in stock for this medicine." });

        return Ok(batch);
    }

    [HttpPost("drugs/{id:guid}/batches")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist")]
    public async Task<IActionResult> InwardBatch(Guid id, [FromBody] InwardBatchRequest req, CancellationToken ct)
    {
        var drug = await _db.Drugs.FindAsync([id], ct);
        if (drug == null)
            return NotFound(new { error = "drug_not_found" });

        if (string.IsNullOrWhiteSpace(req.BatchNumber) || req.QuantityReceived <= 0 || req.Mrp <= 0)
            return BadRequest(new { error = "invalid_batch_details" });

        if (!DateOnly.TryParse(req.ExpiryDate, out var expiryDate))
            return BadRequest(new { error = "invalid_expiry_date" });

        DateOnly? mfgDate = null;
        if (!string.IsNullOrWhiteSpace(req.MfgDate) && DateOnly.TryParse(req.MfgDate, out var parsedMfg))
        {
            mfgDate = parsedMfg;
        }

        var batch = new DrugBatch
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            DrugId = id,
            BatchNumber = req.BatchNumber.Trim().ToUpperInvariant(),
            ExpiryDate = expiryDate,
            MfgDate = mfgDate,
            QuantityReceived = req.QuantityReceived,
            QuantityRemaining = req.QuantityReceived,
            Mrp = req.Mrp,
            PurchaseRate = req.PurchaseRate,
            SupplierId = req.SupplierId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.DrugBatches.Add(batch);
        drug.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new { id = batch.Id, message = "batch_inwarded" });
    }

    // ==========================================
    // 3. FAST POS CHECKOUT (WALK-IN & RX)
    // ==========================================

    [HttpPost("checkout")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Receptionist", "Doctor")]
    public async Task<IActionResult> CheckoutPos([FromBody] PosCheckoutRequest req, CancellationToken ct)
    {
        if (req.Items == null || req.Items.Count == 0)
            return BadRequest(new { error = "no_items_in_cart" });

        // Idempotency check
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existing = await _db.Invoices
                .Include(i => i.LineItems)
                .Include(i => i.Payments)
                .FirstOrDefaultAsync(i => i.IdempotencyKey == req.IdempotencyKey, ct);

            if (existing != null)
            {
                return Ok(new
                {
                    invoiceId = existing.Id,
                    invoiceNumber = $"PHARM-{existing.InvoiceNumber:D6}",
                    subtotal = existing.Subtotal,
                    gstAmount = existing.GstAmount,
                    total = existing.Total,
                    status = existing.Status.ToString(),
                    message = "idempotent_duplicate"
                });
            }
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var currentUserId = User.GetUserId() ?? Guid.Empty;

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            // Fetch and validate batches
            var batchIds = req.Items.Select(i => i.DrugBatchId).Distinct().ToList();
            var batches = new List<DrugBatch>();
            foreach (var bId in batchIds)
            {
                var b = await _db.DrugBatches.Include(x => x.Drug).FirstOrDefaultAsync(x => x.Id == bId, ct);
                if (b != null) batches.Add(b);
            }

            var batchMap = batches.ToDictionary(b => b.Id);

            decimal subtotal = 0m;
            decimal totalGst = 0m;
            var scheduleH1Items = new List<(DrugBatch Batch, int Qty, Drug Drug)>();

            foreach (var item in req.Items)
            {
                if (!batchMap.TryGetValue(item.DrugBatchId, out var batch))
                    return BadRequest(new { error = $"batch_not_found: {item.DrugBatchId}" });

                if (batch.ExpiryDate < today)
                    return BadRequest(new { error = $"cannot_dispense_expired_batch: {batch.BatchNumber}" });

                if (batch.QuantityRemaining < item.Quantity)
                    return BadRequest(new { error = $"insufficient_stock_for_batch: {batch.BatchNumber} (Available: {batch.QuantityRemaining}, Requested: {item.Quantity})" });

                var drug = batch.Drug!;
                if (drug.ScheduleClass is ScheduleClass.ScheduleH1 or ScheduleClass.NDPS or ScheduleClass.ScheduleX)
                {
                    scheduleH1Items.Add((batch, item.Quantity, drug));
                }

                var lineAmount = item.UnitPrice * item.Quantity;
                var gstAmount = Math.Round(lineAmount * (item.GstRate / 100m), 2);

                subtotal += lineAmount;
                totalGst += gstAmount;
            }

            // Regulatory Check for Schedule H1 / NDPS
            if (scheduleH1Items.Count > 0)
            {
                if (string.IsNullOrWhiteSpace(req.PrescriberName) || string.IsNullOrWhiteSpace(req.PrescriberRegNo))
                {
                    return BadRequest(new
                    {
                        error = "schedule_h1_prescriber_required",
                        message = "Prescription and Doctor Medical Registration No. are legally mandated under Drugs & Cosmetics Act 2013 Gazette for Schedule H1 / NDPS drugs."
                    });
                }

                var patientIdentifier = req.PatientName ?? req.WalkInCustomerName;
                if (string.IsNullOrWhiteSpace(patientIdentifier))
                {
                    return BadRequest(new
                    {
                        error = "patient_name_required_for_scheduled_drug",
                        message = "Patient name is required for statutory Schedule H1 dispensing register."
                    });
                }
            }

            // Deduct stock
            foreach (var item in req.Items)
            {
                var batch = batchMap[item.DrugBatchId];
                batch.QuantityRemaining -= item.Quantity;
            }

            var maxInvoiceNumber = await _db.Invoices.MaxAsync(i => (int?)i.InvoiceNumber, ct) ?? 0;
            var invoiceTotal = subtotal + totalGst;

            var invoice = new Invoice
            {
                Id = Guid.NewGuid(),
                TenantId = Guid.Empty,
                AppointmentId = null, // Walk-in pharmacy sale
                PatientId = req.PatientId,
                InvoiceType = InvoiceType.Pharmacy,
                WalkInCustomerName = req.WalkInCustomerName ?? req.PatientName,
                WalkInCustomerPhone = req.WalkInCustomerPhone,
                InvoiceNumber = maxInvoiceNumber + 1,
                Subtotal = subtotal,
                GstAmount = totalGst,
                Total = invoiceTotal,
                Status = InvoiceStatus.Paid,
                IdempotencyKey = req.IdempotencyKey,
                CreatedAt = DateTimeOffset.UtcNow
            };

            foreach (var item in req.Items)
            {
                var batch = batchMap[item.DrugBatchId];
                var drug = batch.Drug!;
                var lineAmount = item.UnitPrice * item.Quantity;

                invoice.LineItems.Add(new InvoiceLineItem
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoice.Id,
                    Description = $"{drug.Name} (Batch: {batch.BatchNumber})",
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                    Amount = lineAmount,
                    GstRate = item.GstRate,
                    HsnCode = drug.HsnCode,
                    DrugBatchId = batch.Id
                });
            }

            _db.Invoices.Add(invoice);

            // Record Payment into unified Payments table (MOD-11 Ledger auto-reconciles this!)
            var paymentMethod = PaymentMethod.Cash;
            if (!string.IsNullOrWhiteSpace(req.PaymentMethod))
            {
                Enum.TryParse<PaymentMethod>(req.PaymentMethod, true, out paymentMethod);
            }

            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                InvoiceId = invoice.Id,
                Amount = invoiceTotal,
                Method = paymentMethod,
                Status = PaymentStatus.Completed,
                PaidAt = DateTimeOffset.UtcNow
            };
            _db.Payments.Add(payment);

            // Log statutory entries for Schedule H1 / NDPS
            var dispenserUser = await _db.Users.FindAsync([currentUserId], ct);
            var dispenserName = dispenserUser?.Name ?? "Pharmacist";

            foreach (var (batch, qty, drug) in scheduleH1Items)
            {
                _db.ControlledSubstanceRegisters.Add(new ControlledSubstanceRegister
                {
                    Id = Guid.NewGuid(),
                    TenantId = Guid.Empty,
                    InvoiceId = invoice.Id,
                    DrugId = drug.Id,
                    ScheduleClass = drug.ScheduleClass,
                    DrugName = drug.Name,
                    BatchNumber = batch.BatchNumber,
                    Quantity = qty,
                    PatientName = req.PatientName ?? req.WalkInCustomerName ?? "Walk-in Patient",
                    PatientAddress = req.PatientAddress ?? "Local",
                    PrescriberName = req.PrescriberName!,
                    PrescriberRegNo = req.PrescriberRegNo!,
                    DispensedBy = currentUserId,
                    DispenserName = dispenserName,
                    DispensedAt = DateTimeOffset.UtcNow
                });
            }

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            var tendered = req.TenderedAmount > 0 ? req.TenderedAmount : invoiceTotal;
            var changeDue = Math.Max(0, tendered - invoiceTotal);

            return StatusCode(201, new
            {
                invoiceId = invoice.Id,
                invoiceNumber = $"PHARM-{invoice.InvoiceNumber:D6}",
                subtotal = invoice.Subtotal,
                gstAmount = invoice.GstAmount,
                total = invoice.Total,
                tenderedAmount = tendered,
                changeDue,
                paymentMethod = paymentMethod.ToString(),
                createdAt = invoice.CreatedAt,
                itemCount = req.Items.Count,
                items = invoice.LineItems.Select(li => new
                {
                    description = li.Description,
                    quantity = li.Quantity,
                    unitPrice = li.UnitPrice,
                    amount = li.Amount,
                    gstRate = li.GstRate,
                    hsnCode = li.HsnCode
                })
            });
        });
    }

    // ==========================================
    // 4. STATUTORY SCHEDULE COMPLIANCE REGISTER
    // ==========================================

    [HttpGet("compliance/register")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor")]
    public async Task<IActionResult> GetComplianceRegister(
        [FromQuery] string? schedule,
        [FromQuery] string? startDate,
        [FromQuery] string? endDate,
        [FromQuery] bool exportCsv = false,
        CancellationToken ct = default)
    {
        var q = _db.ControlledSubstanceRegisters.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(schedule) && Enum.TryParse<ScheduleClass>(schedule, true, out var schedClass))
        {
            q = q.Where(r => r.ScheduleClass == schedClass);
        }

        if (!string.IsNullOrWhiteSpace(startDate) && DateTimeOffset.TryParse(startDate, out var start))
        {
            q = q.Where(r => r.DispensedAt >= start.ToUniversalTime());
        }

        if (!string.IsNullOrWhiteSpace(endDate) && DateTimeOffset.TryParse(endDate, out var end))
        {
            q = q.Where(r => r.DispensedAt <= end.ToUniversalTime());
        }

        var records = await q.OrderByDescending(r => r.DispensedAt).ToListAsync(ct);

        if (exportCsv)
        {
            var sb = new StringBuilder();
            sb.AppendLine("ID,Date,ScheduleClass,DrugName,BatchNumber,Quantity,PatientName,PatientAddress,PrescribingDoctor,DoctorRegNo,DispensedBy");
            foreach (var r in records)
            {
                sb.AppendLine($"\"{r.Id}\",\"{r.DispensedAt:yyyy-MM-dd HH:mm}\",\"{r.ScheduleClass}\",\"{EscapeCsv(r.DrugName)}\",\"{r.BatchNumber}\",{r.Quantity},\"{EscapeCsv(r.PatientName)}\",\"{EscapeCsv(r.PatientAddress)}\",\"{EscapeCsv(r.PrescriberName)}\",\"{r.PrescriberRegNo}\",\"{EscapeCsv(r.DispenserName)}\"");
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            return File(bytes, "text/csv", $"statutory_controlled_substance_register_{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        return Ok(records.Select(r => new
        {
            id = r.Id,
            scheduleClass = r.ScheduleClass.ToString(),
            drugName = r.DrugName,
            batchNumber = r.BatchNumber,
            quantity = r.Quantity,
            patientName = r.PatientName,
            patientAddress = r.PatientAddress,
            prescriberName = r.PrescriberName,
            prescriberRegNo = r.PrescriberRegNo,
            dispenserName = r.DispenserName,
            dispensedAt = r.DispensedAt
        }));
    }

    // ==========================================
    // 5. GENERIC SUBSTITUTE FINDER
    // ==========================================

    [HttpGet("substitutes/{drugId:guid}")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor", "Receptionist", "Nurse")]
    public async Task<IActionResult> GetGenericSubstitutes(Guid drugId, CancellationToken ct)
    {
        var drug = await _db.Drugs.AsNoTracking().FirstOrDefaultAsync(d => d.Id == drugId, ct);
        if (drug == null)
            return NotFound(new { error = "drug_not_found" });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Find other drugs with matching GenericName
        var substitutes = await _db.Drugs.AsNoTracking()
            .Include(d => d.Batches)
            .Where(d => d.Id != drugId && (
                EF.Functions.ILike(d.GenericName, $"%{drug.GenericName}%") ||
                EF.Functions.ILike(drug.GenericName, $"%{d.GenericName}%")
            ))
            .ToListAsync(ct);

        var results = substitutes.Select(d =>
        {
            var validBatches = d.Batches.Where(b => b.QuantityRemaining > 0 && b.ExpiryDate >= today).ToList();
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

    // ==========================================
    // 6. PHARMACY METRICS & STATS
    // ==========================================

    [HttpGet("stats")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor")]
    public async Task<IActionResult> GetPharmacyStats(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startOfTodayUtc = DateTime.UtcNow.Date;
        var endOfTodayUtc = startOfTodayUtc.AddDays(1);
        var sixtyDaysLater = today.AddDays(60);

        var totalDrugs = await _db.Drugs.CountAsync(ct);

        // Today's pharmacy sales
        var todaySales = await _db.Invoices
            .Where(i => i.InvoiceType == InvoiceType.Pharmacy
                     && i.Status == InvoiceStatus.Paid
                     && i.CreatedAt >= startOfTodayUtc
                     && i.CreatedAt < endOfTodayUtc)
            .SumAsync(i => (decimal?)i.Total, ct) ?? 0m;

        var todayInvoicesCount = await _db.Invoices
            .CountAsync(i => i.InvoiceType == InvoiceType.Pharmacy
                          && i.Status == InvoiceStatus.Paid
                          && i.CreatedAt >= startOfTodayUtc
                          && i.CreatedAt < endOfTodayUtc, ct);

        // Batches expiring in 60 days
        var expiringSoonBatches = await _db.DrugBatches
            .CountAsync(b => b.QuantityRemaining > 0 && b.ExpiryDate >= today && b.ExpiryDate <= sixtyDaysLater, ct);

        // Expired batches with stock
        var expiredBatches = await _db.DrugBatches
            .CountAsync(b => b.QuantityRemaining > 0 && b.ExpiryDate < today, ct);

        // Low stock drugs (total stock < 20)
        var lowStockCount = await _db.Drugs
            .Where(d => d.Batches.Where(b => b.ExpiryDate >= today).Sum(b => b.QuantityRemaining) < 20)
            .CountAsync(ct);

        // Schedule H1 dispensed today
        var scheduleH1Today = await _db.ControlledSubstanceRegisters
            .CountAsync(r => r.DispensedAt >= startOfTodayUtc && r.DispensedAt < endOfTodayUtc, ct);

        return Ok(new
        {
            totalDrugs,
            todaySales,
            todayInvoicesCount,
            expiringSoonBatches,
            expiredBatches,
            lowStockCount,
            scheduleH1Today
        });
    }

    // ==========================================
    // 7. SUPPLIERS
    // ==========================================

    [HttpGet("suppliers")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist")]
    public async Task<IActionResult> GetSuppliers(CancellationToken ct)
    {
        var suppliers = await _db.Suppliers.AsNoTracking().OrderBy(s => s.Name).ToListAsync(ct);
        return Ok(suppliers);
    }

    [HttpPost("suppliers")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist")]
    public async Task<IActionResult> CreateSupplier([FromBody] CreateSupplierRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "supplier_name_required" });

        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            TenantId = Guid.Empty,
            Name = req.Name.Trim(),
            Gstin = req.Gstin?.Trim() ?? "",
            Phone = req.Phone?.Trim() ?? "",
            Email = req.Email?.Trim() ?? "",
            Address = req.Address?.Trim() ?? "",
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, supplier);
    }

    private static string EscapeCsv(string s) => s.Replace("\"", "\"\"");
}

// ==========================================
// DTOs
// ==========================================

public record CreateDrugRequest(
    string Name,
    string GenericName,
    string? TherapeuticCategory,
    string? DosageForm,
    string? Strength,
    string? ScheduleClass,
    string? HsnCode,
    decimal GstRate,
    bool NlemCovered,
    decimal? DpcoCeilingPrice,
    string? StandardPackSize,
    decimal IndicativeMrp,
    string? CommonBrands
);

public record InwardBatchRequest(
    string BatchNumber,
    string ExpiryDate,
    string? MfgDate,
    int QuantityReceived,
    decimal Mrp,
    decimal PurchaseRate,
    Guid? SupplierId
);

public record PosCheckoutRequest(
    string? WalkInCustomerName,
    string? WalkInCustomerPhone,
    Guid? PatientId,
    string? PatientName,
    string? PatientAddress,
    string? PrescriberName,
    string? PrescriberRegNo,
    string? PaymentMethod,
    decimal TenderedAmount,
    string? IdempotencyKey,
    List<PosCheckoutItem> Items
);

public record PosCheckoutItem(
    Guid DrugId,
    Guid DrugBatchId,
    int Quantity,
    decimal UnitPrice,
    decimal GstRate,
    string? HsnCode
);

public record CreateSupplierRequest(
    string Name,
    string? Gstin,
    string? Phone,
    string? Email,
    string? Address
);
