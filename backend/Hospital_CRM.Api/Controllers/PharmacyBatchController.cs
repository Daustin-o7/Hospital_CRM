using System.Data;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/pharmacy")]
public class PharmacyBatchController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<PharmacyBatchController> _logger;

    public PharmacyBatchController(HospitalCrmDbContext db, ILogger<PharmacyBatchController> logger)
    {
        _db = db;
        _logger = logger;
    }

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

    [HttpPost("purchase-orders/{id:guid}/receive")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist")]
    public async Task<IActionResult> ReceivePurchaseOrder(Guid id, [FromBody] ReceivePurchaseOrderRequest req, CancellationToken ct)
    {
        var po = await _db.PurchaseOrders
            .Include(p => p.Supplier)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (po == null)
            return NotFound(new { error = "purchase_order_not_found" });

        if (po.Status == PurchaseOrderStatus.Received)
            return BadRequest(new { error = "already_received" });

        if (po.Status == PurchaseOrderStatus.Cancelled)
            return BadRequest(new { error = "cannot_receive_cancelled_order" });

        var items = System.Text.Json.JsonSerializer.Deserialize<List<PoReceiveItem>>(po.ItemsJson);
        if (items == null || items.Count == 0)
            return BadRequest(new { error = "no_items_in_purchase_order" });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var createdBatches = new List<object>();

            foreach (var item in items)
            {
                var receivedQty = req.ReceivedQuantities.TryGetValue(item.DrugId, out var qty) ? qty : 0;
                if (receivedQty <= 0)
                    continue;

                var drug = await _db.Drugs.FindAsync([item.DrugId], ct);
                if (drug == null)
                    continue;

                // Use received batch details from request or generate defaults
                var batchNumber = req.BatchNumbers?.TryGetValue(item.DrugId, out var bn) == true && !string.IsNullOrWhiteSpace(bn)
                    ? bn.Trim().ToUpperInvariant()
                    : $"PO-{id:N}-{item.DrugId:N}".Substring(0, Math.Min(20, $"PO-{id:N}-{item.DrugId:N}".Length));

                var expiryDate = req.ExpiryDates?.TryGetValue(item.DrugId, out var exp) == true && DateOnly.TryParse(exp, out var parsedExp)
                    ? parsedExp
                    : today.AddMonths(12);

                var mfgDate = req.MfgDates?.TryGetValue(item.DrugId, out var mfg) == true && DateOnly.TryParse(mfg, out var parsedMfg)
                    ? parsedMfg
                    : today.AddMonths(-1);

                var mrp = req.Mrps?.TryGetValue(item.DrugId, out var mrpVal) == true && mrpVal > 0
                    ? mrpVal
                    : drug.IndicativeMrp > 0 ? drug.IndicativeMrp : 50m;

                var purchaseRate = req.PurchaseRates?.TryGetValue(item.DrugId, out var prVal) == true && prVal > 0
                    ? prVal
                    : Math.Round(mrp * 0.65m, 2);

                var batch = new DrugBatch
                {
                    Id = Guid.NewGuid(),
                    TenantId = Guid.Empty,
                    DrugId = item.DrugId,
                    BatchNumber = batchNumber,
                    ExpiryDate = expiryDate,
                    MfgDate = mfgDate,
                    QuantityReceived = receivedQty,
                    QuantityRemaining = receivedQty,
                    Mrp = mrp,
                    PurchaseRate = purchaseRate,
                    SupplierId = po.SupplierId,
                    CreatedAt = DateTimeOffset.UtcNow
                };

                _db.DrugBatches.Add(batch);
                drug.UpdatedAt = DateTimeOffset.UtcNow;

                createdBatches.Add(new
                {
                    batchId = batch.Id,
                    drugId = item.DrugId,
                    drugName = drug.Name,
                    batchNumber = batch.BatchNumber,
                    expiryDate = batch.ExpiryDate.ToString("yyyy-MM-dd"),
                    quantityReceived = batch.QuantityReceived,
                    mrp = batch.Mrp,
                    purchaseRate = batch.PurchaseRate
                });
            }

            po.Status = PurchaseOrderStatus.Received;
            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return StatusCode(201, new
            {
                purchaseOrderId = po.Id,
                orderNumber = po.OrderNumber,
                status = po.Status.ToString().ToLower(),
                receivedBatches = createdBatches
            });
        });
    }
}
