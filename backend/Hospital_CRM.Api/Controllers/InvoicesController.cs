using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class InvoicesController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IConfiguration _config;
    private readonly RazorpayOrderClient _razorpay;

    public InvoicesController(HospitalCrmDbContext db, IConfiguration config, RazorpayOrderClient razorpay)
    {
        _db = db;
        _config = config;
        _razorpay = razorpay;
    }

    [HttpPost("invoices")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> GenerateInvoice([FromBody] GenerateInvoiceRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await _db.Invoices
                .FirstOrDefaultAsync(i => i.IdempotencyKey == request.IdempotencyKey, ct);
            if (existing is not null)
                return Ok(new
                {
                    invoiceId = existing.Id,
                    invoiceNumber = $"INV-{existing.InvoiceNumber:D6}",
                    gstAmount = existing.GstAmount,
                    total = existing.Total,
                    status = "unpaid"
                });
        }

        var appointment = await _db.Appointments.FindAsync([request.AppointmentId], ct);
        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        var subtotal = request.LineItems.Sum(li => li.Amount);
        var gst = Math.Round(subtotal * 0.18m, 2);
        var total = subtotal + gst;

        var executionStrategy = _db.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var maxNumber = await _db.Invoices.MaxAsync(i => (int?)i.InvoiceNumber, ct) ?? 0;

            var invoice = new Invoice
            {
                Id = Guid.NewGuid(),
                TenantId = appointment.TenantId,
                AppointmentId = request.AppointmentId,
                InvoiceNumber = maxNumber + 1,
                Subtotal = subtotal,
                GstAmount = gst,
                Total = total,
                Status = InvoiceStatus.Issued,
                IdempotencyKey = request.IdempotencyKey,
                CreatedAt = DateTimeOffset.UtcNow
            };

            foreach (var item in request.LineItems)
            {
                _db.InvoiceLineItems.Add(new InvoiceLineItem
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoice.Id,
                    Description = item.Description,
                    Amount = item.Amount
                });
            }

            _db.Invoices.Add(invoice);
            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return StatusCode(201, new
            {
                invoiceId = invoice.Id,
                invoiceNumber = $"INV-{invoice.InvoiceNumber:D6}",
                gstAmount = invoice.GstAmount,
                total = invoice.Total,
                status = "unpaid"
            });
        });
    }

    [HttpPost("invoices/{id:guid}/payment")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> CollectPayment(Guid id, [FromBody] CollectPaymentRequest request, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingPayment = await _db.Payments
                .FirstOrDefaultAsync(p => p.InvoiceId == id && p.IdempotencyKey == request.IdempotencyKey, ct);
            if (existingPayment is not null)
                return Ok(new { status = existingPayment.Status.ToString().ToLower() });
        }

        var invoice = await _db.Invoices.FindAsync([id], ct);
        if (invoice is null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status == InvoiceStatus.Paid)
            return BadRequest(new { error = "invoice_already_paid" });

        if (string.Equals(request.Method, "razorpay", StringComparison.OrdinalIgnoreCase))
        {
            if (!_razorpay.IsConfigured)
                return StatusCode(503, new { error = "razorpay_not_configured" });

            var orderId = await _razorpay.CreateOrderAsync(request.Amount, $"invoice-{invoice.InvoiceNumber}", ct);
            if (string.IsNullOrWhiteSpace(orderId))
                return StatusCode(502, new { error = "razorpay_order_failed" });

            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = invoice.TenantId,
                InvoiceId = id,
                Method = PaymentMethod.Razorpay,
                Amount = request.Amount,
                RazorpayOrderId = orderId,
                Status = PaymentStatus.Pending,
                IdempotencyKey = request.IdempotencyKey,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _db.Payments.Add(payment);
            await _db.SaveChangesAsync(ct);

            return Ok(new
            {
                orderId,
                razorpayKeyId = _razorpay.KeyId,
                amount = request.Amount,
                currency = "INR"
            });
        }

        // B2: manual "Mark as Paid" — cash, an offline card swipe, or a UPI transfer
        // seen on the clinic's own phone. The UTR is what reconciles it later.
        var manualMethod = request.Method.Trim().ToLowerInvariant() switch
        {
            "cash" => PaymentMethod.Cash,
            "upi" => PaymentMethod.UPI,
            "card" => PaymentMethod.Card,
            "netbanking" => PaymentMethod.NetBanking,
            _ => (PaymentMethod?)null
        };

        if (manualMethod is null)
            return BadRequest(new { error = "invalid_payment_method" });

        var manualPayment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = invoice.TenantId,
            InvoiceId = id,
            Method = manualMethod.Value,
            Amount = request.Amount,
            Utr = string.IsNullOrWhiteSpace(request.Utr) ? null : request.Utr.Trim(),
            Status = PaymentStatus.Completed,
            PaidAt = DateTimeOffset.UtcNow,
            IdempotencyKey = request.IdempotencyKey,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Payments.Add(manualPayment);
        invoice.Status = InvoiceStatus.Paid;
        invoice.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { status = "paid", utr = manualPayment.Utr });
    }

    [HttpPost("webhooks/razorpay")]
    [AllowAnonymous]
    public async Task<IActionResult> RazorpayWebhook(CancellationToken ct)
    {
        if (!Request.Headers.TryGetValue("X-Razorpay-Signature", out var signatureHeader) || string.IsNullOrWhiteSpace(signatureHeader))
            return BadRequest(new { error = "missing_webhook_signature" });

        // SEC-013: Never fall back to a hardcoded webhook secret in production.
        // An attacker who knows the default can forge webhook signatures.
        var secret = _config["Razorpay:WebhookSecret"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            var env = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>();
            if (env.IsDevelopment())
                secret = "dev_webhook_secret_key";
            else
                return StatusCode(503, new { error = "webhook_not_configured" });
        }
        
        using var reader = new StreamReader(Request.Body);
        var bodyText = await reader.ReadToEndAsync(ct);

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(bodyText));
        var computedSignature = Convert.ToHexStringLower(computedHash);

        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(computedSignature),
            Encoding.UTF8.GetBytes(signatureHeader.ToString().ToLowerInvariant())))
        {
            return BadRequest(new { error = "invalid_webhook_signature" });
        }

        // RLS is enabled on Payments/Invoices. An anonymous webhook has no tenant, and the
        // platform Razorpay account legitimately spans tenants, so this one signed handler
        // is explicitly granted the cross-tenant context for the duration of its transaction.
        await using var rlsTransaction = await _db.Database.BeginTransactionAsync(ct);
        await _db.Database.ExecuteSqlAsync($"SELECT set_config('app.is_platform_admin', 'true', true)", ct);

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(bodyText);
            if (doc.RootElement.TryGetProperty("event", out var eventProp))
            {
                var eventName = eventProp.GetString();
                if (string.Equals(eventName, "payment.captured", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(eventName, "order.paid", StringComparison.OrdinalIgnoreCase))
                {
                    if (doc.RootElement.TryGetProperty("payload", out var payload) &&
                        payload.TryGetProperty("payment", out var payObj) &&
                        payObj.TryGetProperty("entity", out var entity))
                    {
                        var razorpayPaymentId = entity.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                        var razorpayOrderId = entity.TryGetProperty("order_id", out var orderProp) ? orderProp.GetString() : null;

                        Payment? payment = null;
                        if (!string.IsNullOrEmpty(razorpayPaymentId))
                        {
                            payment = await _db.Payments.IgnoreQueryFilters()
                                .FirstOrDefaultAsync(p => p.RazorpayPaymentId == razorpayPaymentId, ct);
                        }

                        // F6: a checkout payment is only identified by its order until the
                        // capture webhook arrives, so match on the order we created.
                        if (payment is null && !string.IsNullOrEmpty(razorpayOrderId))
                        {
                            payment = await _db.Payments.IgnoreQueryFilters()
                                .FirstOrDefaultAsync(p => p.RazorpayOrderId == razorpayOrderId, ct);
                        }

                        if (payment is not null && payment.Status != PaymentStatus.Completed)
                        {
                            payment.Status = PaymentStatus.Completed;
                            payment.PaidAt = DateTimeOffset.UtcNow;
                            if (!string.IsNullOrEmpty(razorpayPaymentId))
                                payment.RazorpayPaymentId = razorpayPaymentId;

                            var invoice = await _db.Invoices.IgnoreQueryFilters()
                                .FirstOrDefaultAsync(i => i.Id == payment.InvoiceId, ct);
                            if (invoice is not null)
                            {
                                if (payment.TenantId == Guid.Empty)
                                    payment.TenantId = invoice.TenantId;
                                invoice.Status = InvoiceStatus.Paid;
                                invoice.UpdatedAt = DateTimeOffset.UtcNow;
                            }
                            await _db.SaveChangesAsync(ct);
                        }
                    }
                }
            }

            await rlsTransaction.CommitAsync(ct);
        }
        catch
        {
            await rlsTransaction.RollbackAsync(ct);
            // Signature was valid; avoid failing webhook delivery on malformed event json
        }

        return Ok(new { status = "ok" });
    }


    [HttpGet("invoices")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> ListInvoices([FromQuery] string? status, [FromQuery] Guid? doctorId, CancellationToken ct)
    {
        var role = User.GetUserRole();
        var userId = User.GetUserId();

        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var query = _db.Invoices
            .Include(i => i.Appointment).ThenInclude(a => a.Patient)
            .AsQueryable();

        // Doctor sees only their invoices; Receptionist & Admin can view list (FR-17/18/19)
        // Note: Pharmacy invoices have AppointmentId = null, filter them out for doctor-scoped queries
        if (string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(i => i.Appointment != null && i.Appointment.DoctorId == userId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<InvoiceStatus>(status, true, out var statusEnum))
            query = query.Where(i => i.Status == statusEnum);

        if (doctorId.HasValue)
            query = query.Where(i => i.Appointment != null && i.Appointment.DoctorId == doctorId.Value);

        var invoices = await query
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                invoiceId = i.Id,
                invoiceNumber = $"INV-{i.InvoiceNumber:D6}",
                patientName = i.Appointment != null ? i.Appointment.Patient.Name : (i.WalkInCustomerName ?? "Walk-in Customer"),
                total = i.Total,
                status = i.Status.ToString().ToLower(),
                createdAt = i.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(invoices);
    }
}

public record GenerateInvoiceRequest(
    [Required(ErrorMessage = "Appointment ID is required")]
    Guid AppointmentId,

    [Required(ErrorMessage = "LineItems are required"), MinLength(1, ErrorMessage = "At least one line item is required"), MaxLength(50, ErrorMessage = "Maximum 50 line items per invoice")]
    List<InvoiceLineItemRequest> LineItems,

    [RegularExpression(@"^IDEMP-INV-[a-zA-Z0-9\-]+$", ErrorMessage = "IdempotencyKey must follow format IDEMP-INV-{UUID}")]
    string? IdempotencyKey);

public record InvoiceLineItemRequest(
    [Required(ErrorMessage = "Description is required"), StringLength(150, MinimumLength = 2, ErrorMessage = "Description must be between 2 and 150 characters")]
    string Description,

    [Range(0.01, 1000000.00, ErrorMessage = "Amount must be between ₹0.01 and ₹10,00,000")]
    decimal Amount);

public record CollectPaymentRequest(
    [Required(ErrorMessage = "Payment Method is required"), RegularExpression("(?i)^(cash|upi|card|netbanking|razorpay)$", ErrorMessage = "Method must be cash, upi, card, netbanking or razorpay")]
    string Method,

    [Range(0.01, 1000000.00, ErrorMessage = "Amount must be between ₹0.01 and ₹10,00,000")]
    decimal Amount,

    [RegularExpression(@"^IDEMP-PAY-[a-zA-Z0-9\-]+$", ErrorMessage = "IdempotencyKey must follow format IDEMP-PAY-{UUID}")]
    string? IdempotencyKey,

    [MaxLength(64)]
    string? Utr = null);
