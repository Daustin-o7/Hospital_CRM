using System.Data;
using System.Security.Cryptography;
using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
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

    public InvoicesController(HospitalCrmDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
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

        if (string.Equals(request.Method, "cash", StringComparison.OrdinalIgnoreCase))
        {
            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                InvoiceId = id,
                Method = PaymentMethod.Cash,
                Amount = request.Amount,
                Status = PaymentStatus.Completed,
                IdempotencyKey = request.IdempotencyKey,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _db.Payments.Add(payment);
            invoice.Status = InvoiceStatus.Paid;
            await _db.SaveChangesAsync(ct);

            return Ok(new { status = "paid" });
        }

        if (string.Equals(request.Method, "razorpay", StringComparison.OrdinalIgnoreCase))
        {
            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                InvoiceId = id,
                Method = PaymentMethod.Razorpay,
                Amount = request.Amount,
                Status = PaymentStatus.Pending,
                IdempotencyKey = request.IdempotencyKey,
                CreatedAt = DateTimeOffset.UtcNow
            };

            _db.Payments.Add(payment);
            await _db.SaveChangesAsync(ct);

            return Ok(new { paymentLinkUrl = $"https://checkout.razorpay.com/v1/pay/{payment.Id}" });
        }

        return BadRequest(new { error = "invalid_payment_method" });
    }

    [HttpPost("webhooks/razorpay")]
    [AllowAnonymous]
    public async Task<IActionResult> RazorpayWebhook(CancellationToken ct)
    {
        if (!Request.Headers.TryGetValue("X-Razorpay-Signature", out var signatureHeader) || string.IsNullOrWhiteSpace(signatureHeader))
            return BadRequest(new { error = "missing_webhook_signature" });

        var secret = _config["Razorpay:WebhookSecret"] ?? "dev_webhook_secret_key";
        
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

                        Payment? payment = null;
                        if (!string.IsNullOrEmpty(razorpayPaymentId))
                        {
                            payment = await _db.Payments.FirstOrDefaultAsync(p => p.RazorpayPaymentId == razorpayPaymentId, ct);
                        }

                        if (payment is not null && payment.Status != PaymentStatus.Completed)
                        {
                            payment.Status = PaymentStatus.Completed;
                            payment.PaidAt = DateTimeOffset.UtcNow;
                            var invoice = await _db.Invoices.FindAsync([payment.InvoiceId], ct);
                            if (invoice is not null)
                            {
                                invoice.Status = InvoiceStatus.Paid;
                            }
                            await _db.SaveChangesAsync(ct);
                        }
                    }
                }
            }
        }
        catch
        {
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
    Guid AppointmentId,
    List<InvoiceLineItemRequest> LineItems,
    string? IdempotencyKey);

public record InvoiceLineItemRequest(
    string Description,
    decimal Amount);

public record CollectPaymentRequest(
    string Method,
    decimal Amount,
    string? IdempotencyKey);
