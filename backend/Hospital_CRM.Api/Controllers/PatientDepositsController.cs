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
public class PatientDepositsController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public PatientDepositsController(HospitalCrmDbContext db) => _db = db;

    private Guid TenantId => User.GetTenantId() ?? Guid.Empty;

    [HttpPost("patients/{patientId:guid}/deposits")]
    [AuthorizeRoles("Receptionist", "ClinicAdmin")]
    [RequirePermission(Permissions.PaymentRecord)]
    public async Task<IActionResult> CollectDeposit(Guid patientId, [FromBody] CreatePatientDepositRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var currentUserId = User.GetUserId() ?? Guid.Empty;

        if (req.Amount <= 0)
            return BadRequest(new { error = "invalid_amount", message = "Deposit amount must be greater than zero." });

        var patient = await _db.Patients
            .FirstOrDefaultAsync(p => p.Id == patientId && p.TenantId == tenantId, ct);
        if (patient == null)
            return NotFound(new { error = "patient_not_found" });

        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existing = await _db.PatientDeposits
                .FirstOrDefaultAsync(d => d.TenantId == tenantId && d.PatientId == patientId && d.IdempotencyKey == req.IdempotencyKey, ct);
            if (existing != null)
            {
                return Ok(new
                {
                    depositId = existing.Id,
                    receiptNumber = existing.ReceiptNumber,
                    patientId = existing.PatientId,
                    amount = existing.Amount,
                    balance = existing.Balance,
                    method = existing.Method.ToString(),
                    status = existing.Status.ToString().ToLower(),
                    createdAt = existing.CreatedAt,
                    idempotentDuplicate = true
                });
            }
        }

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var now = DateTimeOffset.UtcNow;
            var financialYear = IndianFinancialYearUtils.GetFinancialYear(now);

            // Gapless sequential numbering per tenant + FY
            var maxSeq = await _db.PatientDeposits
                .Where(d => d.TenantId == tenantId && d.FinancialYear == financialYear)
                .Select(d => (int?)d.SequenceNumber)
                .MaxAsync(ct) ?? 0;

            var nextSeq = maxSeq + 1;
            var receiptNumber = $"DEP-{financialYear}-{nextSeq:D6}";

            var deposit = new PatientDeposit
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ClinicId = User.GetClinicId(),
                PatientId = patientId,
                ReceiptNumber = receiptNumber,
                FinancialYear = financialYear,
                SequenceNumber = nextSeq,
                Amount = req.Amount,
                AllocatedAmount = 0.0m,
                RefundedAmount = 0.0m,
                Balance = req.Amount,
                Method = req.Method,
                ReferenceNumber = string.IsNullOrWhiteSpace(req.ReferenceNumber) ? null : req.ReferenceNumber.Trim(),
                Notes = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim(),
                Status = PatientDepositStatus.Active,
                CollectedByUserId = currentUserId,
                IdempotencyKey = req.IdempotencyKey,
                CreatedAt = now,
                UpdatedAt = now
            };

            _db.PatientDeposits.Add(deposit);

            // Double-entry accounting:
            // Debit: Cash / Bank (Asset increases)
            // Credit: PatientDeposits (Liability increases — unearned revenue / advance held for patient)
            var debitAccount = req.Method == PaymentMethod.Cash ? "Cash" : "Bank";

            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.DepositCollected,
                ReferenceType = "PatientDeposit",
                ReferenceId = deposit.Id,
                ReferenceNumber = receiptNumber,
                AccountCategory = debitAccount,
                DebitAmount = req.Amount,
                CreditAmount = 0.0m,
                Narration = $"Patient advance deposit received from {patient.Name} via {req.Method}. Receipt: {receiptNumber}",
                PostedByUserId = currentUserId,
                CreatedAt = now
            });

            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.DepositCollected,
                ReferenceType = "PatientDeposit",
                ReferenceId = deposit.Id,
                ReferenceNumber = receiptNumber,
                AccountCategory = "PatientDeposits",
                DebitAmount = 0.0m,
                CreditAmount = req.Amount,
                Narration = $"Advance liability recorded for {patient.Name}. Receipt: {receiptNumber}",
                PostedByUserId = currentUserId,
                CreatedAt = now
            });

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return StatusCode(201, new
            {
                depositId = deposit.Id,
                receiptNumber = deposit.ReceiptNumber,
                financialYear = deposit.FinancialYear,
                sequenceNumber = deposit.SequenceNumber,
                patientId = deposit.PatientId,
                amount = deposit.Amount,
                balance = deposit.Balance,
                method = deposit.Method.ToString(),
                referenceNumber = deposit.ReferenceNumber,
                notes = deposit.Notes,
                status = deposit.Status.ToString().ToLower(),
                createdAt = deposit.CreatedAt
            });
        });
    }

    [HttpGet("patients/{patientId:guid}/deposits")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> GetPatientDeposits(Guid patientId, CancellationToken ct)
    {
        var tenantId = TenantId;
        var patient = await _db.Patients
            .FirstOrDefaultAsync(p => p.Id == patientId && p.TenantId == tenantId, ct);
        if (patient == null)
            return NotFound(new { error = "patient_not_found" });

        var deposits = await _db.PatientDeposits
            .Include(d => d.Allocations)
            .Where(d => d.PatientId == patientId && d.TenantId == tenantId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(ct);

        var totalDeposited = deposits.Sum(d => d.Amount);
        var totalAllocated = deposits.Sum(d => d.AllocatedAmount);
        var totalRefunded = deposits.Sum(d => d.RefundedAmount);
        var availableBalance = deposits.Where(d => d.Status == PatientDepositStatus.Active).Sum(d => d.Balance);

        return Ok(new
        {
            patientId,
            patientName = patient.Name,
            totalDeposited,
            totalAllocated,
            totalRefunded,
            availableBalance,
            deposits = deposits.Select(d => new
            {
                depositId = d.Id,
                receiptNumber = d.ReceiptNumber,
                amount = d.Amount,
                allocatedAmount = d.AllocatedAmount,
                refundedAmount = d.RefundedAmount,
                balance = d.Balance,
                method = d.Method.ToString(),
                referenceNumber = d.ReferenceNumber,
                status = d.Status.ToString().ToLower(),
                createdAt = d.CreatedAt,
                allocationsCount = d.Allocations.Count
            })
        });
    }

    [HttpPost("invoices/{id:guid}/apply-advance")]
    [AuthorizeRoles("Receptionist", "ClinicAdmin")]
    [RequirePermission(Permissions.PaymentRecord)]
    public async Task<IActionResult> ApplyAdvanceToInvoice(Guid id, [FromBody] ApplyAdvanceRequest? req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var currentUserId = User.GetUserId() ?? Guid.Empty;

        var invoice = await _db.Invoices
            .Include(i => i.Payments)
            .Include(i => i.Appointment)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status != InvoiceStatus.Finalized && invoice.Status != InvoiceStatus.PartiallyPaid)
            return BadRequest(new { error = "invoice_not_finalized", message = "Advance can only be applied to finalized invoices with an outstanding balance." });

        if (invoice.BalanceDue <= 0m)
            return BadRequest(new { error = "invoice_already_paid", message = "Invoice has no balance due." });

        var patientId = invoice.Appointment?.PatientId;
        if (!patientId.HasValue)
            return BadRequest(new { error = "patient_not_linked", message = "Invoice must be linked to an appointment with a patient to apply advances." });

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            // Fetch active deposits for this patient
            var depositsQuery = _db.PatientDeposits
                .Where(d => d.TenantId == tenantId && d.PatientId == patientId.Value && d.Status == PatientDepositStatus.Active && d.Balance > 0);

            if (req?.DepositId.HasValue == true)
                depositsQuery = depositsQuery.Where(d => d.Id == req.DepositId.Value);

            var activeDeposits = await depositsQuery
                .OrderBy(d => d.CreatedAt)
                .ToListAsync(ct);

            var availableAdvance = activeDeposits.Sum(d => d.Balance);
            if (availableAdvance <= 0m)
                return BadRequest(new { error = "no_advance_available", message = "Patient has no available advance deposit balance." });

            var maxApplicable = Math.Min(invoice.BalanceDue, availableAdvance);
            var requestedAmount = req?.Amount.HasValue == true ? req.Amount.Value : maxApplicable;

            if (requestedAmount <= 0m)
                return BadRequest(new { error = "invalid_advance_amount", message = "Requested advance amount must be greater than zero." });

            if (requestedAmount > invoice.BalanceDue)
                return BadRequest(new { error = "amount_exceeds_balance", message = $"Requested advance ₹{requestedAmount:F2} exceeds balance due ₹{invoice.BalanceDue:F2}." });

            if (requestedAmount > availableAdvance)
                return BadRequest(new { error = "amount_exceeds_available_advance", message = $"Requested advance ₹{requestedAmount:F2} exceeds available advance of ₹{availableAdvance:F2}." });

            var remainingToAllocate = requestedAmount;
            var now = DateTimeOffset.UtcNow;
            var invoiceRef = invoice.FormatInvoiceNumber();
            var allocationsSummary = new List<object>();

            foreach (var deposit in activeDeposits)
            {
                if (remainingToAllocate <= 0m) break;

                var allocAmount = Math.Min(deposit.Balance, remainingToAllocate);
                deposit.AllocatedAmount += allocAmount;
                deposit.Balance -= allocAmount;
                if (deposit.Balance <= 0m)
                    deposit.Status = PatientDepositStatus.FullyAllocated;
                deposit.UpdatedAt = now;

                var allocation = new PatientDepositAllocation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PatientDepositId = deposit.Id,
                    InvoiceId = invoice.Id,
                    AllocatedAmount = allocAmount,
                    AllocatedByUserId = currentUserId,
                    AllocatedAt = now,
                    Notes = $"Applied to {invoiceRef}"
                };
                _db.PatientDepositAllocations.Add(allocation);

                allocationsSummary.Add(new
                {
                    allocationId = allocation.Id,
                    depositId = deposit.Id,
                    receiptNumber = deposit.ReceiptNumber,
                    amount = allocAmount,
                    depositRemainingBalance = deposit.Balance
                });

                remainingToAllocate -= allocAmount;
            }

            // Record Payment row on Invoice
            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                InvoiceId = invoice.Id,
                Method = PaymentMethod.AdvanceDeposit,
                Amount = requestedAmount,
                Utr = $"ADV-{invoiceRef}",
                Status = PaymentStatus.Completed,
                VerificationStatus = PaymentVerificationStatus.Confirmed,
                ConfirmedByUserId = currentUserId,
                PaidAt = now,
                ConfirmedAt = now,
                CreatedAt = now
            };
            _db.Payments.Add(payment);

            // Update Invoice balance
            invoice.PaidAmount += requestedAmount;
            invoice.BalanceDue = Math.Max(0m, invoice.Total - invoice.PaidAmount);
            invoice.Status = invoice.BalanceDue <= 0m ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;
            invoice.UpdatedAt = now;

            // Double-entry accounting for advance application:
            // Debit: PatientDeposits (Liability reduced)
            // Credit: AccountsReceivable (Asset/Receivable reduced)
            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.DepositApplied,
                ReferenceType = "PatientDepositAllocation",
                ReferenceId = payment.Id,
                ReferenceNumber = invoiceRef,
                AccountCategory = "PatientDeposits",
                DebitAmount = requestedAmount,
                CreditAmount = 0.0m,
                Narration = $"Patient advance of ₹{requestedAmount:F2} applied to {invoiceRef}",
                PostedByUserId = currentUserId,
                CreatedAt = now
            });

            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.DepositApplied,
                ReferenceType = "Invoice",
                ReferenceId = invoice.Id,
                ReferenceNumber = invoiceRef,
                AccountCategory = "AccountsReceivable",
                DebitAmount = 0.0m,
                CreditAmount = requestedAmount,
                Narration = $"Receivable offset for {invoiceRef} using advance deposit",
                PostedByUserId = currentUserId,
                CreatedAt = now
            });

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Ok(new
            {
                invoiceId = invoice.Id,
                invoiceNumber = invoiceRef,
                allocatedAdvanceAmount = requestedAmount,
                paidAmount = invoice.PaidAmount,
                balanceDue = invoice.BalanceDue,
                status = invoice.Status.ToString().ToLower(),
                allocations = allocationsSummary
            });
        });
    }
}

public record CreatePatientDepositRequest(
    [Range(0.01, 10000000.00, ErrorMessage = "Amount must be between ₹0.01 and ₹1,00,00,000")]
    decimal Amount,

    PaymentMethod Method,

    [MaxLength(100)]
    string? ReferenceNumber = null,

    [MaxLength(500)]
    string? Notes = null,

    string? IdempotencyKey = null);

public record ApplyAdvanceRequest(
    [Range(0.01, 10000000.00)]
    decimal? Amount = null,

    Guid? DepositId = null);
