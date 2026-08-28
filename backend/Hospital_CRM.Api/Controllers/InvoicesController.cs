using System.Security.Claims;
using Hospital_CRM.Api.Authorization;
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

    public InvoicesController(HospitalCrmDbContext db)
    {
        _db = db;
    }

    [HttpPost("invoices")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> GenerateInvoice([FromBody] GenerateInvoiceRequest request, CancellationToken ct)
    {
        // Idempotency check
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

        return StatusCode(201, new
        {
            invoiceId = invoice.Id,
            invoiceNumber = $"INV-{invoice.InvoiceNumber:D6}",
            gstAmount = invoice.GstAmount,
            total = invoice.Total,
            status = "unpaid"
        });
    }

    [HttpPost("invoices/{id:guid}/payment")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> CollectPayment(Guid id, [FromBody] CollectPaymentRequest request, CancellationToken ct)
    {
        // Idempotency check
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

            // Stub: in production, create Razorpay order and return checkout URL
            return Ok(new { paymentLinkUrl = $"https://checkout.razorpay.com/v1/pay/{payment.Id}" });
        }

        return BadRequest(new { error = "invalid_payment_method" });
    }

    [HttpPost("webhooks/razorpay")]
    [AllowAnonymous]
    public async Task<IActionResult> RazorpayWebhook([FromBody] object payload, CancellationToken ct)
    {
        // Stub: verify X-Razorpay-Signature header in production
        // Log webhook payload for now
        await Task.CompletedTask;
        return Ok(new { status = "ok" });
    }

    [HttpGet("invoices")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> ListInvoices([FromQuery] string? status, [FromQuery] Guid? doctorId, CancellationToken ct)
    {
        var role = User.FindFirst("role")?.Value;
        var userId = Guid.Parse(User.FindFirst("sub")!.Value);

        var query = _db.Invoices
            .Include(i => i.Appointment).ThenInclude(a => a.Patient)
            .AsQueryable();

        if (string.Equals(role, "Receptionist", StringComparison.OrdinalIgnoreCase))
            return Forbid();

        if (string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(i => i.Appointment.DoctorId == userId);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<InvoiceStatus>(status, true, out var statusEnum))
            query = query.Where(i => i.Status == statusEnum);

        if (doctorId.HasValue)
            query = query.Where(i => i.Appointment.DoctorId == doctorId.Value);

        var invoices = await query
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                invoiceId = i.Id,
                invoiceNumber = $"INV-{i.InvoiceNumber:D6}",
                patientName = i.Appointment.Patient.Name,
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
