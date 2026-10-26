using System.ComponentModel.DataAnnotations;
using System.Data;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Utils;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class PaymentsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public PaymentsController(HospitalCrmDbContext db) => _db = db;

    private Guid TenantId => User.GetTenantId() ?? Guid.Empty;

    [HttpPost("invoices/{id:guid}/payments/dynamic-qr")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> GenerateDynamicQr(Guid id, [FromBody] DynamicQrRequest? req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices
            .Include(i => i.LineItems)
            .Include(i => i.Appointment)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status is InvoiceStatus.Paid or InvoiceStatus.Cancelled or InvoiceStatus.Refunded)
            return BadRequest(new { error = "invoice_already_paid" });

        var amountPayable = invoice.BalanceDue > 0 ? invoice.BalanceDue : invoice.Total;
        if (amountPayable <= 0)
            return BadRequest(new { error = "nothing_to_pay" });

        // The invoice's own clinic decides which bank account may receive the money.
        // A user with no clinic claim (tenant-level admin) keeps the previous tenant-wide fallback.
        var clinicId = invoice.Appointment?.ClinicId ?? User.GetClinicId();
        var clinic = clinicId.HasValue
            ? await _db.Clinics.FirstOrDefaultAsync(c => c.Id == clinicId.Value, ct)
            : await _db.Clinics.FirstOrDefaultAsync(ct);
        var clinicName = clinic?.LegalName ?? clinic?.Name ?? "Clinic";

        var now = DateTimeOffset.UtcNow;
        var accountsQuery = _db.PayeeAccounts
            .Where(p => p.TenantId == tenantId && p.IsActive
                     && (!clinicId.HasValue || p.ClinicId == clinicId.Value));

        // Filter out accounts still in 24h cooling off
        var eligibleAccounts = await accountsQuery
            .Where(p => !p.CoolingOffUntil.HasValue || p.CoolingOffUntil.Value <= now)
            .OrderBy(p => p.PriorityOrder)
            .ToListAsync(ct);

        if (eligibleAccounts.Count == 0)
        {
            // If cooling off accounts exist, return informative cooling-off response
            var inCooling = await accountsQuery.AnyAsync(ct);
            return StatusCode(503, new
            {
                error = "payee_account_unavailable",
                message = inCooling
                    ? "Configured payee account is currently in 24-hour security cooling-off period."
                    : "No active clinic payee bank account or UPI ID configured."
            });
        }

        // Selection: Primary or Backup account toggle
        PayeeAccount selectedAccount;
        var useBackup = req?.UseBackupAccount == true;
        if (useBackup)
        {
            selectedAccount = eligibleAccounts.FirstOrDefault(p => p.PriorityOrder > 1) ?? eligibleAccounts.First();
        }
        else
        {
            selectedAccount = eligibleAccounts.First();
        }

        var invoiceRef = invoice.FormatInvoiceNumber();
        var encodedClinic = Uri.EscapeDataString(clinicName);
        var encodedNote = Uri.EscapeDataString($"Bill {invoiceRef}");

        // Standard NPCI UPI Intent / Deep Link specification
        var upiUri = $"upi://pay?pa={selectedAccount.Vpa}&pn={encodedClinic}&am={amountPayable:F2}&tr={invoice.Id:N}&cu=INR&tn={encodedNote}";

        return Ok(new
        {
            invoiceId = invoice.Id,
            invoiceNumber = invoiceRef,
            amount = amountPayable,
            currency = "INR",
            upiUri,
            account = new
            {
                id = selectedAccount.Id,
                vpa = selectedAccount.Vpa,
                accountHolderName = selectedAccount.AccountHolderName,
                bankName = selectedAccount.BankName,
                accountNumberMasked = selectedAccount.AccountNumberMasked,
                priorityOrder = selectedAccount.PriorityOrder,
                isBackup = selectedAccount.PriorityOrder > 1
            },
            backupAvailable = eligibleAccounts.Any(p => p.PriorityOrder > 1)
        });
    }

    [HttpPost("invoices/{id:guid}/payments/report")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> ReportPayment(Guid id, [FromBody] ReportPaymentRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status is InvoiceStatus.Paid or InvoiceStatus.Cancelled or InvoiceStatus.Refunded || invoice.BalanceDue <= 0)
            return BadRequest(new { error = "invoice_already_paid" });

        if (invoice.Status is InvoiceStatus.Draft)
            return BadRequest(new { error = "invoice_not_finalized", message = "Finalize the invoice before reporting a payment." });

        var method = ParseMethod(req.Method);
        if (method is null)
            return BadRequest(new { error = "invalid_payment_method" });

        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existing = await _db.Payments.FirstOrDefaultAsync(
                p => p.TenantId == tenantId && p.InvoiceId == id && p.IdempotencyKey == req.IdempotencyKey, ct);
            if (existing is not null)
                return Ok(new { paymentId = existing.Id, status = "reported", idempotentReplay = true });
        }

        var reportedAmount = req.Amount > 0 ? req.Amount : invoice.BalanceDue;
        if (reportedAmount <= 0 || reportedAmount > invoice.BalanceDue)
            return BadRequest(new
            {
                error = "amount_exceeds_balance",
                message = $"Reported amount must be between ₹0.01 and the balance due of ₹{invoice.BalanceDue:F2}."
            });

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            InvoiceId = id,
            Method = method.Value,
            Amount = reportedAmount,
            Utr = string.IsNullOrWhiteSpace(req.Utr) ? null : req.Utr.Trim(),
            Status = PaymentStatus.Pending,
            VerificationStatus = PaymentVerificationStatus.Reported,
            ReportedAt = DateTimeOffset.UtcNow,
            IdempotencyKey = req.IdempotencyKey,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Payments.Add(payment);
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            paymentId = payment.Id,
            status = "reported",
            message = "Payment reported by patient. Verification required by staff against bank credit / soundbox before invoice is marked paid."
        });
    }

    [HttpPost("invoices/{id:guid}/payments/confirm")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    [RequirePermission(Permissions.PaymentRecord)]
    public async Task<IActionResult> ConfirmPayment(Guid id, [FromBody] ConfirmPaymentRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        var method = ParseMethod(req.Method);
        if (method is null)
            return BadRequest(new { error = "invalid_payment_method" });

        // Idempotent replay: the same key must not move money twice.
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var replay = invoice.Payments.FirstOrDefault(p => p.IdempotencyKey == req.IdempotencyKey);
            if (replay is { Status: PaymentStatus.Completed })
                return Ok(ConfirmResult(invoice, replay, alreadyConfirmed: true));
            if (replay is not null)
                req = req with { PaymentId = replay.Id };
        }

        if (invoice.Status is InvoiceStatus.Paid or InvoiceStatus.Cancelled or InvoiceStatus.Refunded || invoice.BalanceDue <= 0)
            return BadRequest(new { error = "invoice_already_paid" });

        if (invoice.Status is InvoiceStatus.Draft)
            return BadRequest(new { error = "invoice_not_finalized", message = "Finalize the invoice before confirming a payment." });

        var amount = req.Amount > 0 ? req.Amount : invoice.BalanceDue;
        if (amount <= 0 || amount > invoice.BalanceDue)
            return BadRequest(new
            {
                error = "amount_exceeds_balance",
                message = $"Payment must be between ₹0.01 and the balance due of ₹{invoice.BalanceDue:F2}."
            });

        var profile = await _db.TenantTaxProfiles.FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);
        var thresholdUtr = profile?.ThresholdHighValueUtr ?? 2000.0m;

        // Mandatory UTR above clinic threshold for UPI/Bank transfers
        if (method != PaymentMethod.Cash && amount >= thresholdUtr && string.IsNullOrWhiteSpace(req.Utr))
        {
            return BadRequest(new
            {
                error = "utr_mandatory_above_threshold",
                message = $"Bank UTR / Transaction Reference is mandatory for electronic payments of ₹{thresholdUtr:N0} and above."
            });
        }

        var currentUserId = User.GetUserId();
        var now = DateTimeOffset.UtcNow;

        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        // Check if matching pending reported payment exists to confirm
        Payment? payment = null;
        if (req.PaymentId.HasValue)
            payment = invoice.Payments.FirstOrDefault(p => p.Id == req.PaymentId.Value);

        if (payment is { Status: PaymentStatus.Completed })
            return BadRequest(new { error = "payment_already_confirmed" });

        if (payment == null)
        {
            payment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                InvoiceId = id,
                Method = method.Value,
                Amount = amount,
                Utr = string.IsNullOrWhiteSpace(req.Utr) ? null : req.Utr.Trim(),
                Status = PaymentStatus.Completed,
                VerificationStatus = PaymentVerificationStatus.Confirmed,
                PaidAt = now,
                ConfirmedAt = now,
                ConfirmedByUserId = currentUserId,
                IdempotencyKey = req.IdempotencyKey,
                CreatedAt = now
            };
            _db.Payments.Add(payment);
        }
        else
        {
            payment.Method = method.Value;
            payment.Amount = amount;
            payment.Utr = string.IsNullOrWhiteSpace(req.Utr) ? payment.Utr : req.Utr.Trim();
            payment.Status = PaymentStatus.Completed;
            payment.VerificationStatus = PaymentVerificationStatus.Confirmed;
            payment.PaidAt = now;
            payment.ConfirmedAt = now;
            payment.ConfirmedByUserId = currentUserId;
            if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
                payment.IdempotencyKey = req.IdempotencyKey;
        }

        // Update invoice payment balance
        invoice.PaidAmount += amount;
        invoice.BalanceDue = Math.Max(0m, invoice.Total - invoice.PaidAmount);
        invoice.Status = invoice.BalanceDue <= 0m ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;
        invoice.UpdatedAt = now;

        // Append-only financial ledger entry (Credit AccountsReceivable, Debit Cash/Bank)
        var debitAccount = method == PaymentMethod.Cash ? "Cash" : "Bank";
        var invoiceRef = invoice.FormatInvoiceNumber();

        _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryType = FinanceEntryType.PaymentConfirmed,
            ReferenceType = "Payment",
            ReferenceId = payment.Id,
            ReferenceNumber = payment.Utr ?? invoiceRef,
            AccountCategory = debitAccount,
            DebitAmount = amount,
            CreditAmount = 0.0m,
            Narration = $"Payment confirmed for {invoiceRef} via {method}. UTR: {payment.Utr ?? "N/A"}",
            PostedByUserId = currentUserId,
            CreatedAt = now
        });

        _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryType = FinanceEntryType.PaymentConfirmed,
            ReferenceType = "Invoice",
            ReferenceId = invoice.Id,
            ReferenceNumber = invoiceRef,
            AccountCategory = "AccountsReceivable",
            DebitAmount = 0.0m,
            CreditAmount = amount,
            Narration = $"Receivable offset for {invoiceRef} from payment {payment.Id:N}",
            PostedByUserId = currentUserId,
            CreatedAt = now
        });

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return Ok(ConfirmResult(invoice, payment, alreadyConfirmed: false));
    }

    private static PaymentMethod? ParseMethod(string? raw) => raw?.Trim().ToLowerInvariant() switch
    {
        "cash" => PaymentMethod.Cash,
        "upi" => PaymentMethod.UPI,
        "card" => PaymentMethod.Card,
        "netbanking" => PaymentMethod.NetBanking,
        _ => null
    };

    private static object ConfirmResult(Invoice invoice, Payment payment, bool alreadyConfirmed) => new
    {
        paymentId = payment.Id,
        invoiceId = invoice.Id,
        invoiceNumber = invoice.FormatInvoiceNumber(),
        status = invoice.Status.ToString().ToLower(),
        paidAmount = invoice.PaidAmount,
        balanceDue = invoice.BalanceDue,
        utr = payment.Utr,
        confirmedAt = payment.ConfirmedAt,
        alreadyConfirmed
    };
}

public record DynamicQrRequest(bool UseBackupAccount = false);

public record ReportPaymentRequest(
    [Required] string Method,
    decimal Amount = 0.0m,
    string? Utr = null,
    string? IdempotencyKey = null);

public record ConfirmPaymentRequest(
    [Required] string Method,
    decimal Amount = 0.0m,
    string? Utr = null,
    Guid? PaymentId = null,
    string? IdempotencyKey = null);
