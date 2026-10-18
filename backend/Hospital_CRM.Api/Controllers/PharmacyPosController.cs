using System.Data;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/pharmacy")]
public class PharmacyPosController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<PharmacyPosController> _logger;
    private readonly ITimezoneService _timezoneService;

    public PharmacyPosController(HospitalCrmDbContext db, ILogger<PharmacyPosController> logger, ITimezoneService timezoneService)
    {
        _db = db;
        _logger = logger;
        _timezoneService = timezoneService;
    }

    [HttpPost("checkout")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Receptionist", "Doctor")]
    public async Task<IActionResult> CheckoutPos([FromBody] PosCheckoutRequest req, CancellationToken ct)
    {
        // SEC-009: Tenant feature flag check applied uniformly to walk-in checkout
        if (!await PharmacyCommon.IsPharmacyEnabledAsync(_db, ct))
        {
            return StatusCode(403, new { error = "pharmacy_feature_disabled", message = "Pharmacy feature is disabled for this tenant. Contact PlatformAdmin to enable." });
        }

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

                // SEC-004: Validate client-supplied UnitPrice against the batch's actual MRP.
                if (item.UnitPrice > batch.Mrp * 1.01m)
                    return BadRequest(new { error = $"unit_price_exceeds_mrp: {batch.BatchNumber}", maxPrice = batch.Mrp });
                if (item.UnitPrice < batch.PurchaseRate * 0.5m)
                    return BadRequest(new { error = $"unit_price_below_floor: {batch.BatchNumber}", floorPrice = Math.Round(batch.PurchaseRate * 0.5m, 2), mrp = batch.Mrp });

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
                AppointmentId = null,
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

    [HttpPost("returns/{invoiceId:guid}")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Receptionist", "Doctor")]
    public async Task<IActionResult> ProcessReturn(Guid invoiceId, [FromBody] ReturnRequest req, CancellationToken ct)
    {
        var invoice = await _db.Invoices
            .Include(i => i.LineItems)
                .ThenInclude(li => li.DrugBatch!)
                    .ThenInclude(db => db.Drug)
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == invoiceId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.InvoiceType != InvoiceType.Pharmacy)
            return BadRequest(new { error = "not_a_pharmacy_invoice" });

        if (invoice.Status == InvoiceStatus.Refunded)
            return BadRequest(new { error = "already_refunded" });

        // Idempotency check
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existing = await _db.Payments
                .FirstOrDefaultAsync(p => p.InvoiceId == invoiceId && p.IdempotencyKey == req.IdempotencyKey, ct);
            if (existing != null)
                return Ok(new { refundId = existing.Id, message = "idempotent_duplicate", status = existing.Status.ToString().ToLower() });
        }

        var currentUserId = User.GetUserId() ?? Guid.Empty;

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            // Restore batch quantities
            foreach (var lineItem in invoice.LineItems)
            {
                if (lineItem.DrugBatchId.HasValue)
                {
                    var batch = await _db.DrugBatches.FindAsync([lineItem.DrugBatchId.Value], ct);
                    if (batch != null)
                    {
                        batch.QuantityRemaining += lineItem.Quantity;
                    }
                }
            }

            // Create refund payment
            var originalPayment = invoice.Payments.FirstOrDefault(p => p.Status == PaymentStatus.Completed);
            var refundMethod = originalPayment?.Method ?? PaymentMethod.Cash;
            var refundAmount = invoice.Total;

            var refundPayment = new Payment
            {
                Id = Guid.NewGuid(),
                InvoiceId = invoice.Id,
                Amount = -refundAmount,
                Method = refundMethod,
                Status = PaymentStatus.Refunded,
                RazorpayPaymentId = originalPayment?.RazorpayPaymentId,
                IdempotencyKey = req.IdempotencyKey,
                CreatedAt = DateTimeOffset.UtcNow,
                PaidAt = DateTimeOffset.UtcNow
            };
            _db.Payments.Add(refundPayment);

            if (refundMethod == PaymentMethod.Razorpay && !string.IsNullOrEmpty(originalPayment?.RazorpayPaymentId))
            {
                refundPayment.RazorpayPaymentId = $"refund_{Guid.NewGuid():N}";
            }

            invoice.Status = InvoiceStatus.Refunded;

            // Reverse ControlledSubstanceRegister entries for scheduled drugs
            var scheduledRegisters = await _db.ControlledSubstanceRegisters
                .Where(r => r.InvoiceId == invoiceId)
                .ToListAsync(ct);

            foreach (var reg in scheduledRegisters)
            {
                _db.ControlledSubstanceRegisters.Add(new ControlledSubstanceRegister
                {
                    Id = Guid.NewGuid(),
                    TenantId = Guid.Empty,
                    InvoiceId = invoice.Id,
                    DrugId = reg.DrugId,
                    ScheduleClass = reg.ScheduleClass,
                    DrugName = reg.DrugName,
                    BatchNumber = reg.BatchNumber,
                    Quantity = -reg.Quantity,
                    PatientName = reg.PatientName,
                    PatientAddress = reg.PatientAddress,
                    PrescriberName = reg.PrescriberName,
                    PrescriberRegNo = reg.PrescriberRegNo,
                    DispensedBy = currentUserId,
                    DispenserName = req.ReturnedByName ?? "Return Processor",
                    DispensedAt = DateTimeOffset.UtcNow
                });
            }

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return StatusCode(201, new
            {
                refundId = refundPayment.Id,
                originalInvoiceId = invoice.Id,
                invoiceNumber = $"PHARM-{invoice.InvoiceNumber:D6}",
                refundAmount,
                refundMethod = refundMethod.ToString(),
                status = "refunded",
                createdAt = refundPayment.CreatedAt,
                reason = req.Reason
            });
        });
    }

    [HttpGet("stats")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor")]
    public async Task<IActionResult> GetPharmacyStats(CancellationToken ct)
    {
        var clinic = await _db.Clinics.FirstOrDefaultAsync(ct);
        var today = _timezoneService.GetClinicToday(clinic?.Timezone, HttpContext);
        var startOfTodayUtc = _timezoneService.GetStartOfDayUtc(today, clinic?.Timezone);
        var endOfTodayUtc = _timezoneService.GetEndOfDayUtc(today, clinic?.Timezone);
        var sixtyDaysLater = today.AddDays(60);

        var totalDrugs = await _db.Drugs.CountAsync(ct);

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

        var expiringSoonBatches = await _db.DrugBatches
            .CountAsync(b => b.QuantityRemaining > 0 && b.ExpiryDate >= today && b.ExpiryDate <= sixtyDaysLater, ct);

        var expiredBatches = await _db.DrugBatches
            .CountAsync(b => b.QuantityRemaining > 0 && b.ExpiryDate < today, ct);

        var lowStockCount = await _db.Drugs
            .Where(d => d.Batches.Where(b => b.ExpiryDate >= today).Sum(b => b.QuantityRemaining) < 20)
            .CountAsync(ct);

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
}
