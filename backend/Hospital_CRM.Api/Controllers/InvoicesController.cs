using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Utils;
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

    private Guid TenantId => User.GetTenantId() ?? Guid.Empty;

    /// <summary>
    /// Finalize postings must balance: Total = Subtotal + GST - invoice discount.
    /// The discount is a contra-revenue debit, so debits (AR + discount) equal credits.
    /// </summary>
    private void PostFinalizeLedger(Invoice invoice, string invoiceRef)
    {
        var userId = User.GetUserId();
        var now = DateTimeOffset.UtcNow;

        _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
        {
            Id = Guid.NewGuid(),
            TenantId = invoice.TenantId,
            EntryType = FinanceEntryType.InvoiceFinalized,
            ReferenceType = "Invoice",
            ReferenceId = invoice.Id,
            ReferenceNumber = invoiceRef,
            AccountCategory = "AccountsReceivable",
            DebitAmount = invoice.Total,
            Narration = $"Finalized invoice {invoiceRef}",
            PostedByUserId = userId,
            CreatedAt = now
        });

        _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
        {
            Id = Guid.NewGuid(),
            TenantId = invoice.TenantId,
            EntryType = FinanceEntryType.InvoiceFinalized,
            ReferenceType = "Invoice",
            ReferenceId = invoice.Id,
            ReferenceNumber = invoiceRef,
            AccountCategory = "ConsultationRevenue",
            CreditAmount = invoice.Subtotal,
            Narration = $"Revenue recognized from invoice {invoiceRef}",
            PostedByUserId = userId,
            CreatedAt = now
        });

        if (invoice.GstAmount > 0)
        {
            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = invoice.TenantId,
                EntryType = FinanceEntryType.InvoiceFinalized,
                ReferenceType = "Invoice",
                ReferenceId = invoice.Id,
                ReferenceNumber = invoiceRef,
                AccountCategory = "GstPayable",
                CreditAmount = invoice.GstAmount,
                Narration = $"GST payable on invoice {invoiceRef}",
                PostedByUserId = userId,
                CreatedAt = now
            });
        }

        if (invoice.DiscountAmount > 0)
        {
            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = invoice.TenantId,
                EntryType = FinanceEntryType.InvoiceFinalized,
                ReferenceType = "Invoice",
                ReferenceId = invoice.Id,
                ReferenceNumber = invoiceRef,
                AccountCategory = "DiscountAllowed",
                DebitAmount = invoice.DiscountAmount,
                Narration = $"Discount on invoice {invoiceRef}: {invoice.DiscountReason}",
                PostedByUserId = userId,
                CreatedAt = now
            });
        }
    }

    [HttpPost("invoices")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    [RequirePermission(Permissions.InvoiceWrite)]
    public async Task<IActionResult> GenerateInvoice([FromBody] GenerateInvoiceRequest request, CancellationToken ct)
    {
        var tenantId = TenantId;

        if (request.LineItems is null || request.LineItems.Count == 0)
            return BadRequest(new { error = "line_items_required" });
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await _db.Invoices
                .Include(i => i.LineItems)
                .FirstOrDefaultAsync(i => i.IdempotencyKey == request.IdempotencyKey && i.TenantId == tenantId, ct);
            if (existing is not null)
                return Ok(new
                {
                    invoiceId = existing.Id,
                    invoiceNumber = existing.FormatInvoiceNumber(),
                    subtotal = existing.Subtotal,
                    gstAmount = existing.GstAmount,
                    total = existing.Total,
                    balanceDue = existing.BalanceDue,
                    status = existing.Status.ToString().ToLower()
                });
        }

        var appointment = await _db.Appointments
            .Include(a => a.Patient)
            .FirstOrDefaultAsync(a => a.Id == request.AppointmentId && a.TenantId == tenantId, ct);

        if (appointment is null)
            return NotFound(new { error = "appointment_not_found" });

        // Retrieve tenant tax profile (or fallback to Notification 12/2017 healthcare exemption defaults)
        var taxProfile = await _db.TenantTaxProfiles
            .FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);

        var defaultTaxCat = taxProfile?.DefaultOpdTaxCategory ?? TaxCategory.Exempt;
        var defaultHsnSac = taxProfile?.DefaultOpdHsnSac ?? "999312";
        var defaultGstRate = taxProfile?.DefaultOpdGstRate ?? 0.0m;
        var docType = taxProfile?.DocumentType ?? InvoiceDocumentType.BillOfSupply;

        decimal calculatedSubtotal = 0m;
        decimal calculatedGst = 0m;

        var lineItemsToCreate = new List<InvoiceLineItem>();

        foreach (var item in request.LineItems)
        {
            if (item.Quantity <= 0)
                return BadRequest(new { error = "invalid_line_quantity", description = item.Description });

            var qty = item.Quantity;
            var unitPrice = item.UnitPrice ?? (item.Amount / qty);

            if (unitPrice <= 0)
                return BadRequest(new { error = "invalid_line_amount", description = item.Description });

            if (item.DiscountAmount < 0 || item.DiscountAmount > qty * unitPrice)
                return BadRequest(new { error = "invalid_line_discount", description = item.Description });

            var hsnSac = !string.IsNullOrWhiteSpace(item.HsnSacCode) ? item.HsnSacCode.Trim() : defaultHsnSac;

            // Client input may raise tax, never zero-rate a taxable line by claiming exemption.
            var taxCat = defaultTaxCat;
            if (!string.IsNullOrWhiteSpace(item.TaxCategory) && Enum.TryParse<TaxCategory>(item.TaxCategory, true, out var parsedCat))
            {
                taxCat = parsedCat;
            }

            decimal lineGstRate;
            if (taxCat is TaxCategory.Exempt or TaxCategory.Nil)
            {
                // Healthcare SAC 9993xx is the only exempt path when the clinic default is taxable.
                if (defaultTaxCat == TaxCategory.Taxable && !hsnSac.StartsWith("9993", StringComparison.Ordinal))
                    return BadRequest(new
                    {
                        error = "tax_category_not_permitted",
                        description = item.Description,
                        message = "This clinic is configured for taxable supplies; exempt lines must use a healthcare SAC (9993xx)."
                    });

                lineGstRate = 0.0m;
            }
            else
            {
                lineGstRate = item.GstRate ?? defaultGstRate;
                if (lineGstRate <= 0)
                    return BadRequest(new { error = "taxable_line_requires_gst_rate", description = item.Description });
            }

            var lineBaseAmount = Math.Max(0m, (qty * unitPrice) - item.DiscountAmount);
            var lineTaxAmount = lineGstRate > 0 ? Math.Round(lineBaseAmount * (lineGstRate / 100.0m), 2) : 0.0m;
            var lineTotalAmount = lineBaseAmount + lineTaxAmount;

            calculatedSubtotal += lineBaseAmount;
            calculatedGst += lineTaxAmount;

            lineItemsToCreate.Add(new InvoiceLineItem
            {
                Id = Guid.NewGuid(),
                Description = item.Description.Trim(),
                Quantity = qty,
                UnitPrice = unitPrice,
                Amount = lineTotalAmount,
                TaxCategory = taxCat,
                HsnSacCode = hsnSac,
                GstRate = lineGstRate,
                TaxAmount = lineTaxAmount,
                DiscountAmount = item.DiscountAmount
            });
        }

        var gross = calculatedSubtotal + calculatedGst;
        if (request.DiscountAmount < 0 || request.DiscountAmount > gross)
            return BadRequest(new { error = "invalid_discount_amount", message = $"Discount must be between 0 and ₹{gross:F2}." });

        if (request.DiscountAmount > 0 && string.IsNullOrWhiteSpace(request.DiscountReason))
            return BadRequest(new { error = "discount_reason_required" });

        var total = gross - request.DiscountAmount;

        // A bill containing any taxable supply is a Tax Invoice, never a Bill of Supply.
        if (calculatedGst > 0)
            docType = InvoiceDocumentType.TaxInvoice;

        var currentFy = IndianFinancialYearUtils.GetFinancialYear(DateTimeOffset.UtcNow);

        var executionStrategy = _db.Database.CreateExecutionStrategy();
        return await executionStrategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var linkedPharmacyId = request.LinkedPharmacyInvoiceId;
            if (!linkedPharmacyId.HasValue && request.AppointmentId != Guid.Empty)
            {
                linkedPharmacyId = await _db.Invoices
                    .Where(i => i.TenantId == appointment.TenantId
                             && i.AppointmentId == request.AppointmentId
                             && i.Series == "PHARM"
                             && i.Status != InvoiceStatus.Cancelled)
                    .OrderByDescending(i => i.CreatedAt)
                    .Select(i => (Guid?)i.Id)
                    .FirstOrDefaultAsync(ct);
            }

            var invoice = new Invoice
            {
                Id = Guid.NewGuid(),
                TenantId = appointment.TenantId,
                AppointmentId = request.AppointmentId,
                PatientId = appointment.PatientId,
                FinancialYear = currentFy,
                Series = "INV",
                DocumentType = docType,
                LinkedPharmacyInvoiceId = linkedPharmacyId,
                Subtotal = calculatedSubtotal,
                GstAmount = calculatedGst,
                DiscountAmount = request.DiscountAmount,
                DiscountReason = request.DiscountReason,
                Total = total,
                PaidAmount = 0.0m,
                BalanceDue = total,
                Status = request.AutoFinalize ? InvoiceStatus.Finalized : InvoiceStatus.Draft,
                IdempotencyKey = request.IdempotencyKey,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            // If auto-finalizing, assign sequential gapless invoice number immediately
            if (request.AutoFinalize)
            {
                var maxNumber = await _db.Invoices
                    .Where(i => i.TenantId == tenantId && i.FinancialYear == currentFy && i.Series == invoice.Series)
                    .MaxAsync(i => (int?)i.InvoiceNumber, ct) ?? 0;
                invoice.InvoiceNumber = maxNumber + 1;
                invoice.FinalizedAt = DateTimeOffset.UtcNow;
                invoice.FinalizedByUserId = User.GetUserId();

                // Post append-only ledger entries
                var invoiceRef = invoice.FormatInvoiceNumber();
                PostFinalizeLedger(invoice, invoiceRef);
            }

            foreach (var lineItem in lineItemsToCreate)
            {
                lineItem.InvoiceId = invoice.Id;
                _db.InvoiceLineItems.Add(lineItem);
            }

            _db.Invoices.Add(invoice);
            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            var invoiceNumStr = invoice.InvoiceNumber > 0
                ? invoice.FormatInvoiceNumber()
                : $"DRAFT-{invoice.Id:N}"[..14];

            return StatusCode(201, new
            {
                invoiceId = invoice.Id,
                invoiceNumber = invoiceNumStr,
                documentType = invoice.DocumentType.ToString(),
                subtotal = invoice.Subtotal,
                gstAmount = invoice.GstAmount,
                discountAmount = invoice.DiscountAmount,
                total = invoice.Total,
                paidAmount = invoice.PaidAmount,
                balanceDue = invoice.BalanceDue,
                status = invoice.Status.ToString().ToLower()
            });
        });
    }

    [HttpPost("invoices/{id:guid}/finalize")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    [RequirePermission(Permissions.InvoiceWrite)]
    public async Task<IActionResult> FinalizeInvoice(Guid id, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices
            .Include(i => i.LineItems)
            .Include(i => i.Appointment).ThenInclude(a => a!.Patient)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status is InvoiceStatus.Finalized or InvoiceStatus.Paid or InvoiceStatus.Issued
            or InvoiceStatus.Cancelled or InvoiceStatus.Refunded)
            return BadRequest(new { error = "invoice_already_finalized" });

        var currentFy = IndianFinancialYearUtils.GetFinancialYear(DateTimeOffset.UtcNow);
        var strategy = _db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var maxNumber = await _db.Invoices
                .Where(i => i.TenantId == tenantId && i.FinancialYear == currentFy && i.Series == invoice.Series)
                .MaxAsync(i => (int?)i.InvoiceNumber, ct) ?? 0;

            invoice.InvoiceNumber = maxNumber + 1;
            invoice.FinancialYear = currentFy;
            invoice.Status = InvoiceStatus.Finalized;
            invoice.FinalizedAt = DateTimeOffset.UtcNow;
            invoice.FinalizedByUserId = User.GetUserId();
            invoice.BalanceDue = Math.Max(0m, invoice.Total - invoice.PaidAmount);
            invoice.UpdatedAt = DateTimeOffset.UtcNow;

            var invoiceRef = invoice.FormatInvoiceNumber();

            // Append-only financial ledger entries
            PostFinalizeLedger(invoice, invoiceRef);

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Ok(new
            {
                invoiceId = invoice.Id,
                invoiceNumber = invoiceRef,
                status = "finalized",
                total = invoice.Total,
                balanceDue = invoice.BalanceDue,
                finalizedAt = invoice.FinalizedAt
            });
        });
    }

    [HttpGet("invoices/{id:guid}/print")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> PrintInvoice(Guid id, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices
            .Include(i => i.LineItems)
            .Include(i => i.Payments)
            .Include(i => i.Appointment).ThenInclude(a => a!.Patient)
            .Include(i => i.Appointment).ThenInclude(a => a!.Doctor)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status is InvoiceStatus.Draft or InvoiceStatus.Cancelled)
            return BadRequest(new { error = "invoice_not_finalized", message = "Finalize the invoice before printing a receipt." });

        var clinicId = invoice.Appointment?.ClinicId;
        var clinic = clinicId.HasValue
            ? await _db.Clinics.FirstOrDefaultAsync(c => c.Id == clinicId.Value, ct)
            : await _db.Clinics.FirstOrDefaultAsync(ct);
        var currentUserId = User.GetUserId() ?? Guid.Empty;

        invoice.PrintCount++;
        invoice.LastPrintedAt = DateTimeOffset.UtcNow;
        var watermark = invoice.PrintCount > 1 ? "DUPLICATE COPY" : "ORIGINAL";

        // Audit print event in append-only table
        _db.InvoicePrintLogs.Add(new InvoicePrintLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            InvoiceId = invoice.Id,
            PrintedByUserId = currentUserId,
            PrintedAt = DateTimeOffset.UtcNow,
            CopyNumber = invoice.PrintCount,
            Watermark = watermark,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _db.SaveChangesAsync(ct);

        var invoiceRef = invoice.FormatInvoiceNumber();

        return Ok(new
        {
            invoiceId = invoice.Id,
            invoiceNumber = invoiceRef,
            documentType = invoice.DocumentType.ToString(),
            watermark,
            printCount = invoice.PrintCount,
            clinic = new
            {
                name = clinic?.Name,
                legalName = clinic?.LegalName,
                address = clinic?.Address,
                phone = clinic?.Phone,
                email = clinic?.Email
            },
            patient = new
            {
                name = invoice.Appointment?.Patient?.Name ?? invoice.WalkInCustomerName ?? "Walk-in Patient",
                uhid = invoice.Appointment?.Patient?.Uhid,
                phone = invoice.Appointment?.Patient?.Phone ?? invoice.WalkInCustomerPhone
            },
            doctor = new
            {
                name = invoice.Appointment?.Doctor?.Name
            },
            lineItems = invoice.LineItems.Select(li => new
            {
                description = li.Description,
                quantity = li.Quantity,
                unitPrice = li.UnitPrice,
                taxCategory = li.TaxCategory.ToString(),
                hsnSacCode = li.HsnSacCode,
                gstRate = li.GstRate,
                taxAmount = li.TaxAmount,
                discountAmount = li.DiscountAmount,
                totalAmount = li.Amount
            }),
            subtotal = invoice.Subtotal,
            gstAmount = invoice.GstAmount,
            discountAmount = invoice.DiscountAmount,
            total = invoice.Total,
            paidAmount = invoice.PaidAmount,
            balanceDue = invoice.BalanceDue,
            status = invoice.Status.ToString().ToLower(),
            createdAt = invoice.CreatedAt,
            finalizedAt = invoice.FinalizedAt
        });
    }

    [HttpPost("invoices/{id:guid}/credit-notes")]
    [AuthorizeRoles("ClinicAdmin", "Owner")]
    public async Task<IActionResult> CreateCreditNote(Guid id, [FromBody] CreateCreditNoteRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status is InvoiceStatus.Draft or InvoiceStatus.Cancelled or InvoiceStatus.Refunded)
            return BadRequest(new { error = "invoice_not_finalized", message = "Credit notes can only be issued against a finalized invoice." });

        var taxProfile = await _db.TenantTaxProfiles.FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);
        var creditNoteThreshold = taxProfile?.ThresholdCreditNoteApproval ?? 5000.0m;

        var currentFy = IndianFinancialYearUtils.GetFinancialYear(DateTimeOffset.UtcNow);
        var series = "CN";
        var strategy = _db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var alreadyCredited = await _db.CreditNotes
                .Where(c => c.InvoiceId == id && c.Status == CreditNoteStatus.Approved)
                .SumAsync(c => (decimal?)c.Amount, ct) ?? 0m;
            var creditable = invoice.Total - alreadyCredited;

            if (req.Amount <= 0 || req.Amount > creditable)
                return BadRequest(new
                {
                    error = "invalid_credit_note_amount",
                    message = $"Credit note amount must be between ₹0.01 and ₹{creditable:F2} (already credited: ₹{alreadyCredited:F2})."
                });

            var maxSeq = await _db.CreditNotes
                .Where(c => c.TenantId == tenantId && c.FinancialYear == currentFy && c.Series == series)
                .MaxAsync(c => (int?)c.SequenceNumber, ct) ?? 0;

            if (maxSeq == 0)
            {
                var prefix = $"{series}-{currentFy}-";
                var lastNumber = await _db.CreditNotes
                    .Where(c => c.TenantId == tenantId && c.CreditNoteNumber.StartsWith(prefix))
                    .OrderByDescending(c => c.CreditNoteNumber)
                    .Select(c => c.CreditNoteNumber)
                    .FirstOrDefaultAsync(ct);
                if (lastNumber is not null && int.TryParse(lastNumber[prefix.Length..], out var lastParsedSeq))
                {
                    maxSeq = lastParsedSeq;
                }
            }

            var nextSequence = maxSeq + 1;
            var creditNoteNum = $"{series}-{currentFy}-{nextSequence:D6}";
            var currentUserId = User.GetUserId() ?? Guid.Empty;
            var now = DateTimeOffset.UtcNow;

            // Dual-control: amounts above threshold require second approval
            var requiresSecondApproval = req.Amount >= creditNoteThreshold;
            var initialStatus = requiresSecondApproval ? CreditNoteStatus.PendingApproval : CreditNoteStatus.Approved;

            var creditNote = new CreditNote
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                InvoiceId = id,
                CreditNoteNumber = creditNoteNum,
                FinancialYear = currentFy,
                Series = series,
                SequenceNumber = nextSequence,
                Amount = req.Amount,
                Reason = req.Reason.Trim(),
                ApprovedByUserId = currentUserId,
                SecondApprovedByUserId = requiresSecondApproval ? null : currentUserId,
                Status = initialStatus,
                IssuedAt = now,
                CreatedAt = now
            };

            _db.CreditNotes.Add(creditNote);

            // Reversal entry in append-only financial ledger (only if approved immediately)
            if (!requiresSecondApproval)
            {
                var invoiceRef = invoice.FormatInvoiceNumber();
                _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    EntryType = FinanceEntryType.CreditNoteIssued,
                    ReferenceType = "CreditNote",
                    ReferenceId = creditNote.Id,
                    ReferenceNumber = creditNoteNum,
                    AccountCategory = "SalesReturnsAndAllowances",
                    DebitAmount = req.Amount,
                    CreditAmount = 0.0m,
                    Narration = $"Credit note {creditNoteNum} issued against {invoiceRef}. Reason: {req.Reason}",
                    PostedByUserId = currentUserId,
                    CreatedAt = now
                });

                _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    EntryType = FinanceEntryType.CreditNoteIssued,
                    ReferenceType = "Invoice",
                    ReferenceId = invoice.Id,
                    ReferenceNumber = invoiceRef,
                    AccountCategory = "AccountsReceivable",
                    DebitAmount = 0.0m,
                    CreditAmount = req.Amount,
                    Narration = $"Receivable reduced by {creditNoteNum}",
                    PostedByUserId = currentUserId,
                    CreatedAt = now
                });

                // Adjust invoice balance
                invoice.BalanceDue = Math.Max(0m, invoice.BalanceDue - req.Amount);
                invoice.UpdatedAt = now;
            }

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return StatusCode(201, new
            {
                creditNoteId = creditNote.Id,
                creditNoteNumber = creditNote.CreditNoteNumber,
                invoiceId = invoice.Id,
                amount = creditNote.Amount,
                reason = creditNote.Reason,
                status = creditNote.Status.ToString().ToLower(),
                requiresSecondApproval,
                newBalanceDue = invoice.BalanceDue,
                issuedAt = creditNote.IssuedAt
            });
        });
    }

    [HttpPost("credit-notes/{creditNoteId:guid}/approve")]
    [AuthorizeRoles("ClinicAdmin", "Owner")]
    public async Task<IActionResult> ApproveCreditNote(Guid creditNoteId, [FromBody] ApproveCreditNoteRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var creditNote = await _db.CreditNotes
            .Include(c => c.Invoice)
            .FirstOrDefaultAsync(c => c.Id == creditNoteId && c.TenantId == tenantId, ct);

        if (creditNote == null)
            return NotFound(new { error = "credit_note_not_found" });

        if (creditNote.Status != CreditNoteStatus.PendingApproval)
            return BadRequest(new { error = "credit_note_not_pending", message = "This credit note is not pending approval." });

        var currentUserId = User.GetUserId() ?? Guid.Empty;
        if (currentUserId == creditNote.ApprovedByUserId)
            return BadRequest(new { error = "cannot_self_approve", message = "The original approver cannot provide the second approval." });

        var now = DateTimeOffset.UtcNow;

        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        // Re-check the credit cap at approval time: an earlier note may have been approved in between.
        var alreadyCredited = await _db.CreditNotes
            .Where(c => c.InvoiceId == creditNote.InvoiceId && c.Id != creditNote.Id && c.Status == CreditNoteStatus.Approved)
            .SumAsync(c => (decimal?)c.Amount, ct) ?? 0m;
        if (alreadyCredited + creditNote.Amount > creditNote.Invoice.Total)
            return BadRequest(new
            {
                error = "invalid_credit_note_amount",
                message = $"Approving this note would exceed the invoice total (already credited: ₹{alreadyCredited:F2})."
            });

        creditNote.Status = CreditNoteStatus.Approved;
        creditNote.SecondApprovedByUserId = currentUserId;
        creditNote.IssuedAt = now;

        // Post reversal entries to ledger now that it's approved
        var invoiceRef = creditNote.Invoice.FormatInvoiceNumber();
        _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryType = FinanceEntryType.CreditNoteIssued,
            ReferenceType = "CreditNote",
            ReferenceId = creditNote.Id,
            ReferenceNumber = creditNote.CreditNoteNumber,
            AccountCategory = "SalesReturnsAndAllowances",
            DebitAmount = creditNote.Amount,
            CreditAmount = 0.0m,
            Narration = $"Credit note {creditNote.CreditNoteNumber} approved against {invoiceRef}. Reason: {creditNote.Reason}",
            PostedByUserId = currentUserId,
            CreatedAt = now
        });

        _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryType = FinanceEntryType.CreditNoteIssued,
            ReferenceType = "Invoice",
            ReferenceId = creditNote.InvoiceId,
            ReferenceNumber = invoiceRef,
            AccountCategory = "AccountsReceivable",
            DebitAmount = 0.0m,
            CreditAmount = creditNote.Amount,
            Narration = $"Receivable reduced by {creditNote.CreditNoteNumber}",
            PostedByUserId = currentUserId,
            CreatedAt = now
        });

        // Adjust invoice balance
        creditNote.Invoice.BalanceDue = Math.Max(0m, creditNote.Invoice.BalanceDue - creditNote.Amount);
        creditNote.Invoice.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return Ok(new
        {
            creditNoteId = creditNote.Id,
            creditNoteNumber = creditNote.CreditNoteNumber,
            invoiceId = creditNote.InvoiceId,
            amount = creditNote.Amount,
            status = creditNote.Status.ToString().ToLower(),
            secondApprovedByUserId = currentUserId,
            approvedAt = now,
            newBalanceDue = creditNote.Invoice.BalanceDue
        });
    }

    [HttpPost("credit-notes/{creditNoteId:guid}/reject")]
    [AuthorizeRoles("ClinicAdmin", "Owner")]
    public async Task<IActionResult> RejectCreditNote(Guid creditNoteId, [FromBody] RejectCreditNoteRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var creditNote = await _db.CreditNotes
            .FirstOrDefaultAsync(c => c.Id == creditNoteId && c.TenantId == tenantId, ct);

        if (creditNote == null)
            return NotFound(new { error = "credit_note_not_found" });

        if (creditNote.Status != CreditNoteStatus.PendingApproval)
            return BadRequest(new { error = "credit_note_not_pending", message = "This credit note is not pending approval." });

        var currentUserId = User.GetUserId() ?? Guid.Empty;
        if (currentUserId == creditNote.ApprovedByUserId)
            return BadRequest(new { error = "cannot_self_reject", message = "The original approver cannot reject their own credit note." });

        creditNote.Status = CreditNoteStatus.Rejected;
        creditNote.SecondApprovedByUserId = currentUserId;

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            creditNoteId = creditNote.Id,
            creditNoteNumber = creditNote.CreditNoteNumber,
            status = creditNote.Status.ToString().ToLower(),
            rejectedByUserId = currentUserId,
            rejectedAt = DateTimeOffset.UtcNow
        });
    }

    [HttpPost("invoices/{id:guid}/refund")]
    [AuthorizeRoles("ClinicAdmin", "Receptionist")]
    [RequirePermission(Permissions.PaymentRecord)]
    public async Task<IActionResult> ProcessRefund(Guid id, [FromBody] CreateRefundRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var currentUserId = User.GetUserId() ?? Guid.Empty;

        if (req.Amount <= 0)
            return BadRequest(new { error = "invalid_refund_amount", message = "Refund amount must be greater than zero." });

        if (string.IsNullOrWhiteSpace(req.RefundReference))
            return BadRequest(new { error = "refund_reference_required", message = "A valid refund reference (UTR, payment gateway refund ID, or voucher reference) is mandatory." });

        if (string.IsNullOrWhiteSpace(req.Reason))
            return BadRequest(new { error = "refund_reason_required", message = "Reason for refund is mandatory." });

        var invoice = await _db.Invoices
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status is InvoiceStatus.Draft or InvoiceStatus.Cancelled)
            return BadRequest(new { error = "invoice_not_refundable", message = "Refunds cannot be issued against a draft or cancelled invoice." });

        // Idempotency check
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existingRefund = await _db.Payments
                .FirstOrDefaultAsync(p => p.InvoiceId == id && p.IdempotencyKey == req.IdempotencyKey, ct);
            if (existingRefund != null)
            {
                return Ok(new
                {
                    refundId = existingRefund.Id,
                    amount = Math.Abs(existingRefund.Amount),
                    method = existingRefund.Method.ToString(),
                    refundReference = existingRefund.RefundReference,
                    status = existingRefund.Status.ToString().ToLower(),
                    verificationStatus = existingRefund.VerificationStatus.ToString().ToLower(),
                    message = "idempotent_duplicate"
                });
            }
        }

        // Calculate maximum refundable based on confirmed payments minus prior refunds
        var totalPaid = invoice.Payments
            .Where(p => p.Status == PaymentStatus.Completed)
            .Sum(p => p.Amount);
        var totalRefunded = invoice.Payments
            .Where(p => p.Status == PaymentStatus.Refunded && p.VerificationStatus == PaymentVerificationStatus.Confirmed)
            .Sum(p => Math.Abs(p.Amount));
        var maxRefundable = Math.Max(0m, totalPaid - totalRefunded);

        if (req.Amount > maxRefundable)
        {
            return BadRequest(new
            {
                error = "refund_exceeds_paid_balance",
                message = $"Requested refund of ₹{req.Amount:F2} exceeds refundable paid balance of ₹{maxRefundable:F2}."
            });
        }

        // Clinic-set dual approval threshold from TenantTaxProfile (defaults to ₹1,000.00)
        var taxProfile = await _db.TenantTaxProfiles
            .FirstOrDefaultAsync(tp => tp.TenantId == tenantId, ct);
        var threshold = taxProfile?.ThresholdRefundApproval ?? 1000.0m;

        bool requiresDualApproval = req.Amount > threshold;
        Guid? secondApproverId = null;

        if (requiresDualApproval)
        {
            if (req.SecondApprovedByUserId.HasValue)
            {
                if (req.SecondApprovedByUserId.Value == currentUserId)
                {
                    return BadRequest(new
                    {
                        error = "dual_approval_self_approval_blocked",
                        message = "The initiating user cannot serve as their own second approver for refunds exceeding the threshold."
                    });
                }

                var secondApprover = await _db.Users
                    .FirstOrDefaultAsync(u => u.Id == req.SecondApprovedByUserId.Value && u.TenantId == tenantId, ct);
                if (secondApprover == null || secondApprover.Role is not (UserRole.ClinicAdmin or UserRole.Owner or UserRole.Doctor))
                {
                    return BadRequest(new
                    {
                        error = "invalid_second_approver",
                        message = "Second approver must be a valid ClinicAdmin, Owner or Doctor within the clinic."
                    });
                }

                secondApproverId = req.SecondApprovedByUserId.Value;
            }
            else
            {
                // Create pending refund requiring second approval
                var pendingRefund = new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    InvoiceId = id,
                    Method = req.Method,
                    Amount = -req.Amount,
                    Status = PaymentStatus.Pending,
                    VerificationStatus = PaymentVerificationStatus.Pending,
                    ConfirmedByUserId = currentUserId,
                    RefundReference = req.RefundReference.Trim(),
                    RefundReason = req.Reason.Trim(),
                    IdempotencyKey = req.IdempotencyKey,
                    CreatedAt = DateTimeOffset.UtcNow
                };

                _db.Payments.Add(pendingRefund);
                await _db.SaveChangesAsync(ct);

                return StatusCode(202, new
                {
                    refundId = pendingRefund.Id,
                    amount = req.Amount,
                    status = "pending_approval",
                    verificationStatus = "pending",
                    threshold,
                    message = $"Refund amount ₹{req.Amount:F2} exceeds the clinic threshold of ₹{threshold:F2}. Dual approval required before funds are disbursed."
                });
            }
        }

        // If approved, execute within serializable transaction with reversal ledger entries
        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var now = DateTimeOffset.UtcNow;
            var refundPayment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                InvoiceId = id,
                Method = req.Method,
                Amount = -req.Amount,
                Status = PaymentStatus.Refunded,
                VerificationStatus = PaymentVerificationStatus.Confirmed,
                ConfirmedByUserId = currentUserId,
                SecondApprovedByUserId = secondApproverId,
                RefundReference = req.RefundReference.Trim(),
                RefundReason = req.Reason.Trim(),
                IdempotencyKey = req.IdempotencyKey,
                PaidAt = now,
                ConfirmedAt = now,
                CreatedAt = now
            };

            _db.Payments.Add(refundPayment);

            invoice.PaidAmount -= req.Amount;
            invoice.BalanceDue = Math.Max(0m, invoice.Total - invoice.PaidAmount);
            if (invoice.PaidAmount <= 0m)
                invoice.Status = InvoiceStatus.Refunded;
            else
                invoice.Status = InvoiceStatus.PartiallyPaid;
            invoice.UpdatedAt = now;

            var invoiceRef = invoice.FormatInvoiceNumber();
            var cashOrBank = req.Method == PaymentMethod.Cash ? "Cash" : "Bank";

            // Append-only reversal entry 1: Credit Cash/Bank (funds disbursed back)
            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.RefundProcessed,
                ReferenceType = "Refund",
                ReferenceId = refundPayment.Id,
                ReferenceNumber = req.RefundReference.Trim(),
                AccountCategory = cashOrBank,
                DebitAmount = 0.0m,
                CreditAmount = req.Amount,
                Narration = $"Refund of ₹{req.Amount:F2} issued for {invoiceRef} via {req.Method}. Ref: {req.RefundReference}. Reason: {req.Reason}",
                PostedByUserId = currentUserId,
                CreatedAt = now
            });

            // Append-only reversal entry 2: Debit AccountsReceivable (offset reversal)
            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.RefundProcessed,
                ReferenceType = "Invoice",
                ReferenceId = invoice.Id,
                ReferenceNumber = invoiceRef,
                AccountCategory = "AccountsReceivable",
                DebitAmount = req.Amount,
                CreditAmount = 0.0m,
                Narration = $"Receivable reinstatement from refund {refundPayment.Id:N} on {invoiceRef}",
                PostedByUserId = currentUserId,
                CreatedAt = now
            });

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return StatusCode(201, new
            {
                refundId = refundPayment.Id,
                invoiceId = invoice.Id,
                invoiceNumber = invoiceRef,
                amount = req.Amount,
                method = req.Method.ToString(),
                refundReference = req.RefundReference,
                status = "refunded",
                verificationStatus = "confirmed",
                paidAmount = invoice.PaidAmount,
                balanceDue = invoice.BalanceDue,
                dualApproved = requiresDualApproval,
                secondApprovedByUserId = secondApproverId,
                refundedAt = now
            });
        });
    }

    [HttpPost("invoices/{id:guid}/refunds/{refundId:guid}/approve")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> ApproveRefund(Guid id, Guid refundId, [FromBody] ApproveRefundRequest? req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var currentUserId = User.GetUserId() ?? Guid.Empty;

        var refundPayment = await _db.Payments
            .FirstOrDefaultAsync(p => p.Id == refundId && p.InvoiceId == id && p.TenantId == tenantId, ct);

        if (refundPayment == null)
            return NotFound(new { error = "refund_not_found" });

        if (refundPayment.Status != PaymentStatus.Pending || refundPayment.VerificationStatus != PaymentVerificationStatus.Pending)
            return BadRequest(new { error = "refund_not_pending_approval", message = "Refund is not pending approval." });

        if (refundPayment.ConfirmedByUserId == currentUserId)
        {
            return BadRequest(new
            {
                error = "dual_approval_self_approval_blocked",
                message = "The initiating user cannot serve as their own second approver."
            });
        }

        var invoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);
        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        var refundAmount = Math.Abs(refundPayment.Amount);

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var now = DateTimeOffset.UtcNow;
            refundPayment.Status = PaymentStatus.Refunded;
            refundPayment.VerificationStatus = PaymentVerificationStatus.Confirmed;
            refundPayment.SecondApprovedByUserId = currentUserId;
            refundPayment.ConfirmedAt = now;
            refundPayment.PaidAt = now;

            invoice.PaidAmount -= refundAmount;
            invoice.BalanceDue = Math.Max(0m, invoice.Total - invoice.PaidAmount);
            if (invoice.PaidAmount <= 0m)
                invoice.Status = InvoiceStatus.Refunded;
            else
                invoice.Status = InvoiceStatus.PartiallyPaid;
            invoice.UpdatedAt = now;

            var invoiceRef = invoice.FormatInvoiceNumber();
            var cashOrBank = refundPayment.Method == PaymentMethod.Cash ? "Cash" : "Bank";

            // Post append-only ledger entries
            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.RefundProcessed,
                ReferenceType = "Refund",
                ReferenceId = refundPayment.Id,
                ReferenceNumber = refundPayment.RefundReference ?? refundPayment.Id.ToString("N"),
                AccountCategory = cashOrBank,
                DebitAmount = 0.0m,
                CreditAmount = refundAmount,
                Narration = $"Dual-approved refund of ₹{refundAmount:F2} issued for {invoiceRef} via {refundPayment.Method}. Ref: {refundPayment.RefundReference}",
                PostedByUserId = currentUserId,
                CreatedAt = now
            });

            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.RefundProcessed,
                ReferenceType = "Invoice",
                ReferenceId = invoice.Id,
                ReferenceNumber = invoiceRef,
                AccountCategory = "AccountsReceivable",
                DebitAmount = refundAmount,
                CreditAmount = 0.0m,
                Narration = $"Receivable reinstatement from approved refund {refundPayment.Id:N} on {invoiceRef}",
                PostedByUserId = currentUserId,
                CreatedAt = now
            });

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return Ok(new
            {
                refundId = refundPayment.Id,
                invoiceId = invoice.Id,
                invoiceNumber = invoiceRef,
                amount = refundAmount,
                status = "refunded",
                verificationStatus = "confirmed",
                paidAmount = invoice.PaidAmount,
                balanceDue = invoice.BalanceDue,
                secondApprovedByUserId = currentUserId,
                approvedAt = now
            });
        });
    }

    [HttpGet("invoices/{id:guid}")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> GetInvoice(Guid id, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices
            .Include(i => i.LineItems)
            .Include(i => i.Payments)
            .Include(i => i.CreditNotes)
            .Include(i => i.Appointment).ThenInclude(a => a!.Patient)
            .Include(i => i.Appointment).ThenInclude(a => a!.Doctor)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        var invoiceRef = invoice.FormatInvoiceNumber();

        Invoice? linkedPharmacy = null;
        if (invoice.LinkedPharmacyInvoiceId.HasValue)
        {
            linkedPharmacy = await _db.Invoices
                .FirstOrDefaultAsync(i => i.Id == invoice.LinkedPharmacyInvoiceId.Value && i.TenantId == tenantId, ct);
        }

        return Ok(new
        {
            invoiceId = invoice.Id,
            invoiceNumber = invoiceRef,
            documentType = invoice.DocumentType.ToString(),
            appointmentId = invoice.AppointmentId,
            patient = new
            {
                id = invoice.Appointment?.Patient?.Id,
                name = invoice.Appointment?.Patient?.Name ?? invoice.WalkInCustomerName ?? "Walk-in Patient",
                uhid = invoice.Appointment?.Patient?.Uhid,
                phone = invoice.Appointment?.Patient?.Phone ?? invoice.WalkInCustomerPhone
            },
            doctor = new
            {
                id = invoice.Appointment?.Doctor?.Id,
                name = invoice.Appointment?.Doctor?.Name
            },
            lineItems = invoice.LineItems.Select(li => new
            {
                id = li.Id,
                description = li.Description,
                quantity = li.Quantity,
                unitPrice = li.UnitPrice,
                taxCategory = li.TaxCategory.ToString(),
                hsnSacCode = li.HsnSacCode,
                gstRate = li.GstRate,
                taxAmount = li.TaxAmount,
                discountAmount = li.DiscountAmount,
                totalAmount = li.Amount
            }),
            payments = invoice.Payments.Select(p => new
            {
                id = p.Id,
                method = p.Method.ToString(),
                amount = p.Amount,
                utr = p.Utr,
                status = p.Status.ToString(),
                verificationStatus = p.VerificationStatus.ToString(),
                paidAt = p.PaidAt
            }),
            creditNotes = invoice.CreditNotes.Select(cn => new
            {
                id = cn.Id,
                creditNoteNumber = cn.CreditNoteNumber,
                amount = cn.Amount,
                reason = cn.Reason,
                issuedAt = cn.IssuedAt
            }),
            linkedPharmacyInvoiceId = invoice.LinkedPharmacyInvoiceId,
            linkedPharmacyInvoice = linkedPharmacy == null ? null : new
            {
                id = linkedPharmacy.Id,
                invoiceNumber = linkedPharmacy.FormatInvoiceNumber(),
                series = linkedPharmacy.Series,
                financialYear = linkedPharmacy.FinancialYear,
                subtotal = linkedPharmacy.Subtotal,
                gstAmount = linkedPharmacy.GstAmount,
                total = linkedPharmacy.Total,
                paidAmount = linkedPharmacy.PaidAmount,
                balanceDue = linkedPharmacy.BalanceDue,
                status = linkedPharmacy.Status.ToString().ToLower(),
                createdAt = linkedPharmacy.CreatedAt
            },
            subtotal = invoice.Subtotal,
            gstAmount = invoice.GstAmount,
            discountAmount = invoice.DiscountAmount,
            total = invoice.Total,
            paidAmount = invoice.PaidAmount,
            balanceDue = invoice.BalanceDue,
            printCount = invoice.PrintCount,
            status = invoice.Status.ToString().ToLower(),
            createdAt = invoice.CreatedAt,
            finalizedAt = invoice.FinalizedAt
        });
    }

    [HttpPost("invoices/{id:guid}/link-pharmacy")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    public async Task<IActionResult> LinkPharmacyInvoice(Guid id, [FromBody] LinkPharmacyInvoiceRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices.FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);
        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        var pharmInvoice = await _db.Invoices.FirstOrDefaultAsync(i => i.Id == req.PharmacyInvoiceId && i.TenantId == tenantId, ct);
        if (pharmInvoice == null)
            return NotFound(new { error = "pharmacy_invoice_not_found" });

        if (pharmInvoice.Series != "PHARM" && pharmInvoice.InvoiceType != InvoiceType.Pharmacy)
            return BadRequest(new { error = "not_a_pharmacy_invoice", message = "Linked invoice must be a pharmacy invoice (PHARM series)." });

        invoice.LinkedPharmacyInvoiceId = pharmInvoice.Id;
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            invoiceId = invoice.Id,
            linkedPharmacyInvoiceId = pharmInvoice.Id,
            linkedPharmacyInvoiceNumber = pharmInvoice.FormatInvoiceNumber(),
            message = "pharmacy_invoice_linked"
        });
    }

    [HttpGet("invoices/{id:guid}/linked-documents")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin", "Pharmacist")]
    public async Task<IActionResult> GetLinkedDocuments(Guid id, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices.FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);
        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        Invoice? linkedPharmacy = null;
        if (invoice.LinkedPharmacyInvoiceId.HasValue)
        {
            linkedPharmacy = await _db.Invoices
                .FirstOrDefaultAsync(i => i.Id == invoice.LinkedPharmacyInvoiceId.Value && i.TenantId == tenantId, ct);
        }

        var linkedConsultationInvoices = await _db.Invoices
            .Where(i => i.TenantId == tenantId && i.LinkedPharmacyInvoiceId == invoice.Id)
            .Select(i => new
            {
                id = i.Id,
                invoiceNumber = i.FormatInvoiceNumber(),
                series = i.Series,
                financialYear = i.FinancialYear,
                subtotal = i.Subtotal,
                gstAmount = i.GstAmount,
                total = i.Total,
                paidAmount = i.PaidAmount,
                balanceDue = i.BalanceDue,
                status = i.Status.ToString().ToLower(),
                createdAt = i.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(new
        {
            invoiceId = invoice.Id,
            invoiceNumber = invoice.FormatInvoiceNumber(),
            series = invoice.Series,
            linkedPharmacyInvoice = linkedPharmacy == null ? null : new
            {
                id = linkedPharmacy.Id,
                invoiceNumber = linkedPharmacy.FormatInvoiceNumber(),
                series = linkedPharmacy.Series,
                financialYear = linkedPharmacy.FinancialYear,
                subtotal = linkedPharmacy.Subtotal,
                gstAmount = linkedPharmacy.GstAmount,
                total = linkedPharmacy.Total,
                paidAmount = linkedPharmacy.PaidAmount,
                balanceDue = linkedPharmacy.BalanceDue,
                status = linkedPharmacy.Status.ToString().ToLower(),
                createdAt = linkedPharmacy.CreatedAt
            },
            linkedConsultationInvoices
        });
    }

    [HttpPatch("invoices/{id:guid}")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    [RequirePermission(Permissions.InvoiceWrite)]
    public async Task<IActionResult> UpdateInvoiceDraft(Guid id, [FromBody] UpdateInvoiceDraftRequest request, CancellationToken ct)
    {
        var tenantId = TenantId;
        var invoice = await _db.Invoices
            .Include(i => i.LineItems)
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);

        if (invoice == null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status != InvoiceStatus.Draft)
            return BadRequest(new { error = "invoice_not_draft", message = "Only draft invoices can be updated." });

        // Validate line items if provided
        if (request.LineItems is not null)
        {
            if (request.LineItems.Count == 0)
                return BadRequest(new { error = "line_items_required" });

            // Retrieve tenant tax profile for validation
            var taxProfile = await _db.TenantTaxProfiles
                .FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);

            var defaultTaxCat = taxProfile?.DefaultOpdTaxCategory ?? TaxCategory.Exempt;
            var defaultHsnSac = taxProfile?.DefaultOpdHsnSac ?? "999312";
            var defaultGstRate = taxProfile?.DefaultOpdGstRate ?? 0.0m;

            decimal calculatedSubtotal = 0m;
            decimal calculatedGst = 0m;
            var newLineItems = new List<InvoiceLineItem>();

            foreach (var item in request.LineItems)
            {
                if (item.Quantity <= 0)
                    return BadRequest(new { error = "invalid_line_quantity", description = item.Description });

                var qty = item.Quantity;
                var unitPrice = item.UnitPrice ?? (item.Amount / qty);
                if (unitPrice <= 0)
                    return BadRequest(new { error = "invalid_line_amount", description = item.Description });

                if (item.DiscountAmount < 0 || item.DiscountAmount > qty * unitPrice)
                    return BadRequest(new { error = "invalid_line_discount", description = item.Description });

                var hsnSac = !string.IsNullOrWhiteSpace(item.HsnSacCode) ? item.HsnSacCode.Trim() : defaultHsnSac;

                var taxCat = defaultTaxCat;
                if (!string.IsNullOrWhiteSpace(item.TaxCategory) && Enum.TryParse<TaxCategory>(item.TaxCategory, true, out var parsedCat))
                    taxCat = parsedCat;

                decimal lineGstRate;
                if (taxCat is TaxCategory.Exempt or TaxCategory.Nil)
                {
                    if (defaultTaxCat == TaxCategory.Taxable && !hsnSac.StartsWith("9993", StringComparison.Ordinal))
                        return BadRequest(new { error = "tax_category_not_permitted", description = item.Description, message = "This clinic is configured for taxable supplies; exempt lines must use a healthcare SAC (9993xx)." });
                    lineGstRate = 0.0m;
                }
                else
                {
                    lineGstRate = item.GstRate ?? defaultGstRate;
                    if (lineGstRate <= 0)
                        return BadRequest(new { error = "taxable_line_requires_gst_rate", description = item.Description });
                }

                var unitPriceValue = unitPrice ?? 0m;
                var lineBaseAmount = qty * unitPriceValue - item.DiscountAmount;
                var lineGst = Math.Round(lineBaseAmount * lineGstRate / 100m, 2, MidpointRounding.AwayFromZero);

                calculatedSubtotal += lineBaseAmount;
                calculatedGst += lineGst;

                newLineItems.Add(new InvoiceLineItem
                {
                    Id = Guid.NewGuid(),
                    Description = item.Description.Trim(),
                    Quantity = qty,
                    UnitPrice = unitPriceValue,
                    Amount = lineBaseAmount,
                    TaxCategory = taxCat,
                    HsnSacCode = hsnSac,
                    GstRate = lineGstRate,
                    TaxAmount = lineGst
                });
            }

            // Replace line items
            _db.InvoiceLineItems.RemoveRange(invoice.LineItems);
            invoice.LineItems = newLineItems;
            invoice.Subtotal = calculatedSubtotal;
            invoice.GstAmount = calculatedGst;

            // Update document type based on GST
            if (calculatedGst > 0)
                invoice.DocumentType = InvoiceDocumentType.TaxInvoice;
            else
                invoice.DocumentType = InvoiceDocumentType.BillOfSupply;
        }

        // Update discount if provided
        if (request.DiscountAmount.HasValue)
        {
            var gross = invoice.Subtotal + invoice.GstAmount;
            if (request.DiscountAmount.Value < 0 || request.DiscountAmount.Value > gross)
                return BadRequest(new { error = "invalid_discount_amount", message = $"Discount must be between 0 and ₹{gross:F2}." });

            if (request.DiscountAmount.Value > 0 && string.IsNullOrWhiteSpace(request.DiscountReason))
                return BadRequest(new { error = "discount_reason_required" });

            invoice.DiscountAmount = request.DiscountAmount.Value;
            invoice.DiscountReason = request.DiscountReason;
            invoice.Total = gross - invoice.DiscountAmount;
        }

        // Update walk-in customer info if provided
        if (request.WalkInCustomerName is not null)
            invoice.WalkInCustomerName = request.WalkInCustomerName;
        if (request.WalkInCustomerPhone is not null)
            invoice.WalkInCustomerPhone = request.WalkInCustomerPhone;

        invoice.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        var invoiceRef = invoice.FormatInvoiceNumber();
        return Ok(new
        {
            invoiceId = invoice.Id,
            invoiceNumber = invoiceRef,
            subtotal = invoice.Subtotal,
            gstAmount = invoice.GstAmount,
            discountAmount = invoice.DiscountAmount,
            total = invoice.Total,
            balanceDue = invoice.BalanceDue,
            status = invoice.Status.ToString().ToLower(),
            updatedAt = invoice.UpdatedAt
        });
    }

    [HttpPost("invoices/{id:guid}/payment")]
    [AuthorizeRoles("Receptionist", "Doctor", "ClinicAdmin")]
    [RequirePermission(Permissions.PaymentRecord)]
    public async Task<IActionResult> CollectPayment(Guid id, [FromBody] CollectPaymentRequest request, CancellationToken ct)
    {
        var tenantId = TenantId;
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingPayment = await _db.Payments
                .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.InvoiceId == id && p.IdempotencyKey == request.IdempotencyKey, ct);
            if (existingPayment is not null)
                return Ok(new { status = existingPayment.Status.ToString().ToLower(), paymentId = existingPayment.Id });
        }

        var invoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.Id == id && i.TenantId == tenantId, ct);
        if (invoice is null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status is InvoiceStatus.Draft)
            return BadRequest(new { error = "invoice_not_finalized", message = "Finalize the invoice before collecting payment." });

        if (invoice.Status is InvoiceStatus.Paid or InvoiceStatus.Cancelled or InvoiceStatus.Refunded)
            return BadRequest(new { error = "invoice_already_paid" });

        if (request.Amount <= 0 || request.Amount > invoice.BalanceDue)
            return BadRequest(new
            {
                error = "amount_exceeds_balance",
                message = $"Payment must be between ₹0.01 and the balance due of ₹{invoice.BalanceDue:F2}."
            });

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
                VerificationStatus = PaymentVerificationStatus.Pending,
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

        var taxProfile = await _db.TenantTaxProfiles.FirstOrDefaultAsync(p => p.TenantId == tenantId, ct);
        var utrThreshold = taxProfile?.ThresholdHighValueUtr ?? 2000.0m;
        if (manualMethod != PaymentMethod.Cash
            && request.Amount >= utrThreshold
            && string.IsNullOrWhiteSpace(request.Utr))
        {
            return BadRequest(new
            {
                error = "utr_mandatory_above_threshold",
                message = $"Bank UTR / Transaction Reference is mandatory for electronic payments of ₹{utrThreshold:N0} and above."
            });
        }

        var manualPayment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = invoice.TenantId,
            InvoiceId = id,
            Method = manualMethod.Value,
            Amount = request.Amount,
            Utr = string.IsNullOrWhiteSpace(request.Utr) ? null : request.Utr.Trim(),
            Status = PaymentStatus.Completed,
            VerificationStatus = PaymentVerificationStatus.Confirmed,
            PaidAt = DateTimeOffset.UtcNow,
            ConfirmedAt = DateTimeOffset.UtcNow,
            ConfirmedByUserId = User.GetUserId(),
            IdempotencyKey = request.IdempotencyKey,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.Payments.Add(manualPayment);
        invoice.PaidAmount += request.Amount;
        invoice.BalanceDue = Math.Max(0m, invoice.Total - invoice.PaidAmount);
        invoice.Status = invoice.BalanceDue <= 0m ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;
        invoice.UpdatedAt = DateTimeOffset.UtcNow;

        // Every confirmed payment posts to the append-only ledger, whichever endpoint took it.
        var invoiceRef = invoice.FormatInvoiceNumber();
        var cashOrBank = manualMethod == PaymentMethod.Cash ? "Cash" : "Bank";
        _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryType = FinanceEntryType.PaymentConfirmed,
            ReferenceType = "Payment",
            ReferenceId = manualPayment.Id,
            ReferenceNumber = manualPayment.Utr ?? invoiceRef,
            AccountCategory = cashOrBank,
            DebitAmount = request.Amount,
            Narration = $"Payment recorded for {invoiceRef} via {manualMethod}. UTR: {manualPayment.Utr ?? "N/A"}",
            PostedByUserId = User.GetUserId(),
            CreatedAt = DateTimeOffset.UtcNow
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
            CreditAmount = request.Amount,
            Narration = $"Receivable offset for {invoiceRef} from payment {manualPayment.Id:N}",
            PostedByUserId = User.GetUserId(),
            CreatedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return Ok(new { status = "paid", utr = manualPayment.Utr, paidAmount = invoice.PaidAmount, balanceDue = invoice.BalanceDue });
    }

    [HttpPost("webhooks/razorpay")]
    [AllowAnonymous]
    public async Task<IActionResult> RazorpayWebhook(CancellationToken ct)
    {
        if (!Request.Headers.TryGetValue("X-Razorpay-Signature", out var signatureHeader) || string.IsNullOrWhiteSpace(signatureHeader))
            return BadRequest(new { error = "missing_webhook_signature" });

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

                        if (payment is null && !string.IsNullOrEmpty(razorpayOrderId))
                        {
                            payment = await _db.Payments.IgnoreQueryFilters()
                                .FirstOrDefaultAsync(p => p.RazorpayOrderId == razorpayOrderId, ct);
                        }

                        if (payment is not null && payment.Status != PaymentStatus.Completed)
                        {
                            payment.Status = PaymentStatus.Completed;
                            payment.VerificationStatus = PaymentVerificationStatus.Confirmed;
                            payment.PaidAt = DateTimeOffset.UtcNow;
                            payment.ConfirmedAt = DateTimeOffset.UtcNow;
                            if (!string.IsNullOrEmpty(razorpayPaymentId))
                                payment.RazorpayPaymentId = razorpayPaymentId;

                            var invoice = await _db.Invoices.IgnoreQueryFilters()
                                .FirstOrDefaultAsync(i => i.Id == payment.InvoiceId, ct);
                            if (invoice is not null)
                            {
                                if (payment.TenantId == Guid.Empty)
                                    payment.TenantId = invoice.TenantId;
                                invoice.PaidAmount += payment.Amount;
                                invoice.BalanceDue = Math.Max(0m, invoice.Total - invoice.PaidAmount);
                                invoice.Status = invoice.BalanceDue <= 0m ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid;
                                invoice.UpdatedAt = DateTimeOffset.UtcNow;

                                var invoiceRef = invoice.InvoiceNumber > 0
                                    ? invoice.FormatInvoiceNumber()
                                    : $"RAZORPAY-{razorpayPaymentId ?? razorpayOrderId}";
                                _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
                                {
                                    Id = Guid.NewGuid(),
                                    TenantId = invoice.TenantId,
                                    EntryType = FinanceEntryType.PaymentConfirmed,
                                    ReferenceType = "Payment",
                                    ReferenceId = payment.Id,
                                    ReferenceNumber = razorpayPaymentId ?? invoiceRef,
                                    AccountCategory = "Bank",
                                    DebitAmount = payment.Amount,
                                    Narration = $"Razorpay capture for {invoiceRef}",
                                    CreatedAt = DateTimeOffset.UtcNow
                                });
                                _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
                                {
                                    Id = Guid.NewGuid(),
                                    TenantId = invoice.TenantId,
                                    EntryType = FinanceEntryType.PaymentConfirmed,
                                    ReferenceType = "Invoice",
                                    ReferenceId = invoice.Id,
                                    ReferenceNumber = invoiceRef,
                                    AccountCategory = "AccountsReceivable",
                                    CreditAmount = payment.Amount,
                                    Narration = $"Receivable offset for {invoiceRef} from Razorpay payment {payment.Id:N}",
                                    CreatedAt = DateTimeOffset.UtcNow
                                });
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
            // Non-2xx so Razorpay retries; returning 200 here silently loses the capture.
            return StatusCode(500, new { error = "webhook_processing_failed" });
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
            .Include(i => i.Appointment).ThenInclude(a => a!.Patient)
            .AsQueryable();

        if (string.Equals(role, "Doctor", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(i => i.Appointment != null && i.Appointment.DoctorId == userId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (string.Equals(status, "unpaid", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(i => i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled && i.Status != InvoiceStatus.Refunded);
            }
            else if (Enum.TryParse<InvoiceStatus>(status, true, out var statusEnum))
            {
                query = query.Where(i => i.Status == statusEnum);
            }
        }

        if (doctorId.HasValue)
            query = query.Where(i => i.Appointment != null && i.Appointment.DoctorId == doctorId.Value);

        var invoices = await query
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                invoiceId = i.Id,
                invoiceNumber = i.InvoiceNumber > 0 ? $"{(i.Series != null && i.Series != "" ? i.Series : "INV")}-{i.FinancialYear}-{i.InvoiceNumber:D6}" : "DRAFT",
                patientName = i.Appointment != null ? i.Appointment.Patient.Name : (i.WalkInCustomerName ?? "Walk-in Customer"),
                subtotal = i.Subtotal,
                gstAmount = i.GstAmount,
                discountAmount = i.DiscountAmount,
                total = i.Total,
                paidAmount = i.PaidAmount,
                balanceDue = i.BalanceDue,
                status = i.Status.ToString().ToLower(),
                createdAt = i.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(invoices);
    }

    #region Server-Side PDF & Print Verification

    /// <summary>
    /// Generates server-side PDF 1.4 for a finalized invoice (Tax Invoice or Bill of Supply).
    /// Enforces that Draft and Cancelled invoices cannot be printed as statutory invoices.
    /// Every print event is logged to the append-only InvoicePrintLogs table.
    /// </summary>
    [HttpGet("invoices/{id:guid}/pdf")]
    [Authorize]
    public async Task<IActionResult> GetInvoicePdf(Guid id, [FromServices] IPdfService pdfService, CancellationToken ct)
    {
        var invoice = await _db.Invoices
            .Include(i => i.LineItems)
            .Include(i => i.Payments)
            .Include(i => i.Appointment)
                .ThenInclude(a => a!.Patient)
            .FirstOrDefaultAsync(i => i.Id == id, ct);

        if (invoice is null)
            return NotFound(new { error = "invoice_not_found" });

        if (invoice.Status is InvoiceStatus.Draft or InvoiceStatus.Cancelled)
        {
            return BadRequest(new
            {
                error = "cannot_print_draft_or_cancelled_invoice",
                message = "Draft or cancelled invoices cannot be printed as statutory tax invoices."
            });
        }

        var clinic = await _db.Clinics.FirstOrDefaultAsync(c => c.TenantId == invoice.TenantId, ct);

        var priorPrints = await _db.InvoicePrintLogs
            .CountAsync(l => l.InvoiceId == id, ct);

        bool isDuplicate = priorPrints > 0;

        var printLog = new InvoicePrintLog
        {
            Id = Guid.NewGuid(),
            TenantId = invoice.TenantId,
            InvoiceId = invoice.Id,
            PrintedByUserId = User.GetUserId() ?? Guid.Empty,
            PrintedAt = DateTimeOffset.UtcNow,
            CopyNumber = priorPrints + 1,
            Watermark = isDuplicate ? "DUPLICATE COPY" : "ORIGINAL",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        };
        _db.InvoicePrintLogs.Add(printLog);
        await _db.SaveChangesAsync(ct);

        var pdfBytes = pdfService.GenerateInvoicePdf(invoice, clinic, isDuplicate);
        var invoiceRef = invoice.FormatInvoiceNumber();
        var filename = $"{invoiceRef}_{(isDuplicate ? "DUPLICATE" : "ORIGINAL")}.pdf";

        return File(pdfBytes, "application/pdf", filename);
    }

    /// <summary>
    /// Generates server-side PDF 1.4 for an Approved credit note.
    /// Pending approval or Rejected credit notes cannot be printed.
    /// </summary>
    [HttpGet("credit-notes/{id:guid}/pdf")]
    [Authorize]
    public async Task<IActionResult> GetCreditNotePdf(Guid id, [FromServices] IPdfService pdfService, CancellationToken ct)
    {
        var creditNote = await _db.CreditNotes
            .Include(cn => cn.Invoice)
                .ThenInclude(i => i.LineItems)
            .Include(cn => cn.Invoice)
                .ThenInclude(i => i.Appointment)
                    .ThenInclude(a => a!.Patient)
            .FirstOrDefaultAsync(cn => cn.Id == id, ct);

        if (creditNote is null)
            return NotFound(new { error = "credit_note_not_found" });

        if (creditNote.Status != CreditNoteStatus.Approved)
        {
            return BadRequest(new
            {
                error = "cannot_print_unapproved_credit_note",
                message = "Credit notes must be approved before generating statutory PDF."
            });
        }

        var clinic = await _db.Clinics.FirstOrDefaultAsync(c => c.TenantId == creditNote.TenantId, ct);

        var pdfBytes = pdfService.GenerateCreditNotePdf(creditNote, creditNote.Invoice, clinic);
        var cnRef = creditNote.FormatCreditNoteNumber();
        var filename = $"{cnRef}.pdf";

        return File(pdfBytes, "application/pdf", filename);
    }

    #endregion
}

public record GenerateInvoiceRequest(
    [Required(ErrorMessage = "Appointment ID is required")]
    Guid AppointmentId,

    [Required(ErrorMessage = "LineItems are required"), MinLength(1, ErrorMessage = "At least one line item is required"), MaxLength(50, ErrorMessage = "Maximum 50 line items per invoice")]
    List<InvoiceLineItemRequest> LineItems,

    [RegularExpression(@"^IDEMP-INV-[a-zA-Z0-9\-]+$", ErrorMessage = "IdempotencyKey must follow format IDEMP-INV-{UUID}")]
    string? IdempotencyKey = null,

    decimal DiscountAmount = 0.0m,
    string? DiscountReason = null,
    Guid? LinkedPharmacyInvoiceId = null,
    bool AutoFinalize = false);

public record InvoiceLineItemRequest(
    [Required(ErrorMessage = "Description is required"), StringLength(150, MinimumLength = 2, ErrorMessage = "Description must be between 2 and 150 characters")]
    string Description,

    [Range(0.01, 1000000.00, ErrorMessage = "Amount must be between ₹0.01 and ₹10,00,000")]
    decimal Amount,

    int Quantity = 1,
    decimal? UnitPrice = null,
    string? TaxCategory = null,
    string? HsnSacCode = null,
    decimal? GstRate = null,
    decimal DiscountAmount = 0.0m);

public record CreateCreditNoteRequest(
    [Range(0.01, 1000000.00, ErrorMessage = "Credit note amount must be positive")]
    decimal Amount,

    [Required, MinLength(3), MaxLength(500)]
    string Reason);

public record CollectPaymentRequest(
    [Required(ErrorMessage = "Payment Method is required"), RegularExpression("(?i)^(cash|upi|card|netbanking|razorpay)$", ErrorMessage = "Method must be cash, upi, card, netbanking or razorpay")]
    string Method,

    [Range(0.01, 1000000.00, ErrorMessage = "Amount must be between ₹0.01 and ₹10,00,000")]
    decimal Amount,

    [RegularExpression(@"^IDEMP-PAY-[a-zA-Z0-9\-]+$", ErrorMessage = "IdempotencyKey must follow format IDEMP-PAY-{UUID}")]
    string? IdempotencyKey = null,

    [MaxLength(64)]
    string? Utr = null);

public record CreateRefundRequest(
    [Range(0.01, 1000000.00, ErrorMessage = "Refund amount must be between ₹0.01 and ₹10,00,000")]
    decimal Amount,

    PaymentMethod Method,

    [Required(ErrorMessage = "Refund reference (UTR / Gateway refund id / voucher) is required"), MaxLength(100)]
    string RefundReference,

    [Required(ErrorMessage = "Reason is required"), MinLength(3), MaxLength(500)]
    string Reason,

    Guid? SecondApprovedByUserId = null,

    [RegularExpression(@"^IDEMP-REF-[a-zA-Z0-9\-]+$", ErrorMessage = "IdempotencyKey must follow format IDEMP-REF-{UUID}")]
    string? IdempotencyKey = null);

public record ApproveRefundRequest(
    [MaxLength(500)]
    string? Note = null);

public record UpdateInvoiceLineItemRequest(
    [Required, MinLength(1), MaxLength(255)]
    string Description,
    [Range(1, int.MaxValue)]
    int Quantity,
    [Range(0.01, double.MaxValue)]
    decimal? UnitPrice = null,
    [Range(0.01, double.MaxValue)]
    decimal? Amount = null,
    [Range(0, double.MaxValue)]
    decimal DiscountAmount = 0.0m,
    [MaxLength(20)]
    string? HsnSacCode = null,
    [MaxLength(20)]
    string? TaxCategory = null,
    [Range(0, 100)]
    decimal? GstRate = null);

public record UpdateInvoiceDraftRequest(
    List<UpdateInvoiceLineItemRequest>? LineItems = null,
    [Range(0, double.MaxValue)]
    decimal? DiscountAmount = null,
    [MaxLength(255)]
    string? DiscountReason = null,
    [MaxLength(255)]
    string? WalkInCustomerName = null,
    [MaxLength(20)]
    string? WalkInCustomerPhone = null);

public record ApproveCreditNoteRequest(
    [MaxLength(500)]
    string? Note = null);

public record RejectCreditNoteRequest(
    [MaxLength(500)]
    string? Reason = null);

public record LinkPharmacyInvoiceRequest(
    Guid PharmacyInvoiceId);



