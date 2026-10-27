using System.Data;
using System.Text;
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
[Route("api/v1/pharmacy")]
[RequireModule(ModuleRegistry.Pharmacy)]
public class PharmacyComplianceController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<PharmacyComplianceController> _logger;

    public PharmacyComplianceController(
        HospitalCrmDbContext db,
        ILogger<PharmacyComplianceController> logger)
    {
        _db = db;
        _logger = logger;
    }

    private Guid TenantId => User.GetTenantId()!.Value;

    /// <summary>Fail-closed Form 20/21 gate: a missing clinic row or licence is "not licensed".</summary>
    private async Task<Clinic?> GetLicensedClinicAsync(CancellationToken ct)
    {
        var clinic = await _db.Clinics.FirstOrDefaultAsync(ct);
        return clinic != null &&
               (!string.IsNullOrWhiteSpace(clinic.PharmacyLicenceNumber20) ||
                !string.IsNullOrWhiteSpace(clinic.PharmacyLicenceNumber21))
            ? clinic
            : null;
    }

    private static BadRequestObjectResult NdpsBlocked() => new(new
    {
        error = "ndps_digital_dispensing_prohibited",
        message = "NDPS drugs are legally prohibited from digital retail dispensing under NDPS Rules. Physical triplicate official register required."
    });

    /// <summary>
    /// Item → catalogue drug: explicit id first, then exact brand/medicine text, then exact
    /// generic + strength + form. A mismatch is refused; nothing is guessed.
    /// </summary>
    private static Drug? ResolveDrug(PrescriptionItem rxItem, IReadOnlyCollection<Drug> candidates)
    {
        if (rxItem.DrugId is { } id) return candidates.FirstOrDefault(d => d.Id == id);

        var byText = candidates.FirstOrDefault(d =>
            string.Equals(d.Name, rxItem.MedicineText.Trim(), StringComparison.OrdinalIgnoreCase));
        if (byText != null) return byText;

        return candidates.FirstOrDefault(d =>
            string.Equals(d.GenericName, rxItem.GenericName.Trim(), StringComparison.OrdinalIgnoreCase) &&
            string.Equals(d.Strength, rxItem.Strength.Trim(), StringComparison.OrdinalIgnoreCase) &&
            string.Equals(d.DosageForm, rxItem.DosageForm.Trim(), StringComparison.OrdinalIgnoreCase) &&
            (string.IsNullOrWhiteSpace(rxItem.BrandName) ||
             string.Equals(d.Name, rxItem.BrandName.Trim(), StringComparison.OrdinalIgnoreCase)));
    }

    [HttpPost("dispense")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor")]
    public async Task<IActionResult> DispensePrescription([FromBody] DispensePrescriptionRequest req, CancellationToken ct)
    {
        var tenantId = TenantId;

        // 1. Regulatory Licence Gate (Form 20 / Form 21). Fail closed: no clinic row or no
        // licence number means no dispensing.
        if (await GetLicensedClinicAsync(ct) is null)
        {
            return StatusCode(403, new
            {
                error = "pharmacy_licence_missing",
                message = "Clinic must register Form 20 or Form 21 Retail Drug Licence before dispensing medications."
            });
        }

        var prescription = await _db.Prescriptions
            .Include(p => p.Items)
            .Include(p => p.Consultation)
                .ThenInclude(c => c.Doctor)
            .Include(p => p.Consultation)
                .ThenInclude(c => c.Appointment)
                    .ThenInclude(a => a.Patient)
            .FirstOrDefaultAsync(p => p.Id == req.PrescriptionId, ct);

        if (prescription == null)
            return NotFound(new { error = "prescription_not_found" });

        // Ensure prescription is from a finalized consultation (not draft)
        if (prescription.Consultation != null && prescription.Consultation.Status == ConsultationStatus.Draft)
        {
            return BadRequest(new { error = "cannot_dispense_draft_prescription", message = "Prescription must be finalized by doctor before dispensing." });
        }

        // Idempotency check
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existing = await _db.DispenseRecords
                .FirstOrDefaultAsync(d => d.IdempotencyKey == req.IdempotencyKey, ct);
            if (existing != null)
            {
                var existingInvoice = await _db.Invoices
                    .FirstOrDefaultAsync(i => i.IdempotencyKey == $"pharm_inv_{req.IdempotencyKey}", ct);
                return Ok(new
                {
                    dispenseId = existing.Id,
                    invoiceId = existingInvoice?.Id,
                    invoiceNumber = existingInvoice?.FormatInvoiceNumber(),
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

            // Two concurrent callers can pass the pre-transaction check; the in-transaction
            // check plus the filtered unique index turn the second one into a duplicate.
            if (!string.IsNullOrWhiteSpace(req.IdempotencyKey) &&
                await _db.DispenseRecords.AnyAsync(d => d.IdempotencyKey == req.IdempotencyKey, ct))
            {
                var existingInvoice = await _db.Invoices
                    .FirstOrDefaultAsync(i => i.IdempotencyKey == $"pharm_inv_{req.IdempotencyKey}", ct);
                return Ok(new
                {
                    invoiceId = existingInvoice?.Id,
                    invoiceNumber = existingInvoice?.FormatInvoiceNumber(),
                    message = "idempotent_duplicate"
                });
            }

            var patientName = req.PatientName ?? prescription.Consultation?.Appointment?.Patient?.Name ?? "Walk-in Patient";
            var patientAddress = req.PatientAddress ?? "Local";

            var prescriptionItems = prescription.Items.ToList();
            var drugIds = prescriptionItems.Where(i => i.DrugId.HasValue).Select(i => i.DrugId!.Value).Distinct().ToList();
            var medicineTexts = prescriptionItems.Select(i => i.MedicineText.Trim().ToLower()).Distinct().ToList();
            var genericNames = prescriptionItems.Select(i => i.GenericName.Trim().ToLower()).Distinct().ToList();

            var candidateDrugs = await _db.Drugs
                .Include(d => d.Batches)
                .Where(d => drugIds.Contains(d.Id)
                    || medicineTexts.Contains(d.Name.ToLower())
                    || genericNames.Contains(d.GenericName.ToLower()))
                .ToListAsync(ct);

            // 2. NDPS hard block. The prescription's own schedule is authoritative, so a line
            // carrying NDPS is refused even when no catalogue row can be matched.
            if (prescriptionItems.Any(i => i.ScheduleClass == ScheduleClass.NDPS))
                return NdpsBlocked();

            var rxTargets = new List<(PrescriptionItem RxItem, Drug Drug)>();
            foreach (var rxItem in prescriptionItems)
            {
                var targetDrug = ResolveDrug(rxItem, candidateDrugs);
                if (targetDrug is null)
                {
                    return BadRequest(new
                    {
                        error = "drug_not_matched",
                        message = $"'{rxItem.MedicineText}' is not in the pharmacy catalogue. Curate the medicine before dispensing.",
                        prescriptionItemId = rxItem.Id
                    });
                }

                if (targetDrug.ScheduleClass == ScheduleClass.NDPS)
                    return NdpsBlocked();

                var itemSelection = req.ItemSelections?.FirstOrDefault(s => s.PrescriptionItemId == rxItem.Id);

                // Substitution is optional and must stay same generic + strength + form.
                if (itemSelection?.SubstitutedDrugId is { } substitutedId && substitutedId != targetDrug.Id)
                {
                    var substitutedDrug = candidateDrugs.FirstOrDefault(d => d.Id == substitutedId)
                        ?? await _db.Drugs.Include(d => d.Batches).FirstOrDefaultAsync(d => d.Id == substitutedId, ct);

                    if (substitutedDrug is null)
                        return BadRequest(new { error = "substitution_drug_not_found" });

                    if (!string.Equals(targetDrug.GenericName, substitutedDrug.GenericName, StringComparison.OrdinalIgnoreCase) ||
                        !string.Equals(targetDrug.Strength, substitutedDrug.Strength, StringComparison.OrdinalIgnoreCase) ||
                        !string.Equals(targetDrug.DosageForm, substitutedDrug.DosageForm, StringComparison.OrdinalIgnoreCase))
                    {
                        return BadRequest(new
                        {
                            error = "substitution_generic_mismatch",
                            message = $"Substitution permitted only for same generic, strength and form '{targetDrug.GenericName} {targetDrug.Strength}'. Therapeutic substitution requires doctor amendment."
                        });
                    }

                    if (substitutedDrug.ScheduleClass == ScheduleClass.NDPS)
                        return NdpsBlocked();

                    targetDrug = substitutedDrug;
                    rxItem.SubstitutedDrugId = substitutedDrug.Id;
                    rxItem.SubstitutionReason = itemSelection.SubstitutionReason ?? "Pharmacist generic substitution";
                }

                rxTargets.Add((rxItem, targetDrug));
            }

            var dispenseRecord = new DispenseRecord
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PrescriptionId = prescription.Id,
                PatientId = prescription.Consultation?.Appointment?.PatientId,
                WalkInCustomerName = req.PatientName,
                DispensedBy = currentUserId,
                DispensedAt = DateTimeOffset.UtcNow,
                IdempotencyKey = req.IdempotencyKey
            };
            _db.DispenseRecords.Add(dispenseRecord);

            decimal totalAmount = 0m;
            decimal pharmSubtotal = 0m;
            decimal pharmTotalGst = 0m;
            var invoiceLineItems = new List<InvoiceLineItem>();
            var scheduleH1Items = new List<(DrugBatch Batch, int Qty, Drug Drug)>();

            foreach (var (rxItem, targetDrug) in rxTargets)
            {
                var itemSelection = req.ItemSelections?.FirstOrDefault(s => s.PrescriptionItemId == rxItem.Id);

                var remaining = Math.Max(0, rxItem.TotalQuantity - rxItem.DispensedQuantity);
                if (remaining == 0)
                    return BadRequest(new { error = "prescription_item_already_dispensed", prescriptionItemId = rxItem.Id });

                var dispenseQty = itemSelection?.Quantity ?? remaining;
                if (dispenseQty < 1 || dispenseQty > remaining)
                {
                    return BadRequest(new
                    {
                        error = "dispense_quantity_exceeds_prescribed",
                        prescriptionItemId = rxItem.Id,
                        prescribed = rxItem.TotalQuantity,
                        alreadyDispensed = rxItem.DispensedQuantity,
                        requested = dispenseQty
                    });
                }

                // FEFO selection excluding recalled and expired batches; an explicit batch must
                // belong to the resolved drug.
                DrugBatch? availableBatch = null;
                if (itemSelection?.DrugBatchId is { } batchId && batchId != Guid.Empty)
                {
                    availableBatch = targetDrug.Batches.FirstOrDefault(b =>
                        b.Id == batchId && !b.IsRecalled && b.ExpiryDate >= today && b.QuantityRemaining > 0);
                }

                if (availableBatch == null)
                {
                    availableBatch = targetDrug.Batches
                        .Where(b => b.QuantityRemaining > 0 && b.ExpiryDate >= today && !b.IsRecalled)
                        .OrderBy(b => b.ExpiryDate)
                        .FirstOrDefault();
                }

                if (availableBatch == null)
                {
                    return BadRequest(new { error = $"no_active_batch_in_stock: {targetDrug.Name}", drugName = targetDrug.Name });
                }

                // SEC-006: Guard against driving batch stock negative
                if (availableBatch.QuantityRemaining < dispenseQty)
                {
                    return BadRequest(new { error = $"insufficient_stock_for_drug: {targetDrug.Name}", drugName = targetDrug.Name, available = availableBatch.QuantityRemaining, requested = dispenseQty });
                }

                // Statutory register fields come from the signed consultation, never from the caller.
                var prescriberName = prescription.Consultation?.Doctor?.Name;
                var prescriberRegNo = prescription.Consultation?.DoctorRegistrationNumber;

                if (targetDrug.ScheduleClass is ScheduleClass.ScheduleH1 or ScheduleClass.ScheduleX)
                {
                    if (string.IsNullOrWhiteSpace(prescriberName) || string.IsNullOrWhiteSpace(prescriberRegNo))
                    {
                        return BadRequest(new
                        {
                            error = "schedule_h1_prescriber_required",
                            message = "The signed consultation has no prescribing doctor registration number; amend or re-sign before dispensing Schedule H1/X drugs."
                        });
                    }
                    scheduleH1Items.Add((availableBatch, dispenseQty, targetDrug));
                }

                // Row-locked atomic stock deduction
                availableBatch.QuantityRemaining -= dispenseQty;

                // Append-only stock movement ledger
                _db.DrugStockMovements.Add(new DrugStockMovement
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    DrugId = targetDrug.Id,
                    DrugBatchId = availableBatch.Id,
                    Quantity = dispenseQty,
                    Direction = MovementDirection.Out,
                    ReferenceType = "Dispense",
                    ReferenceId = dispenseRecord.Id,
                    Note = $"Dispensed for Rx #{prescription.Id:N}",
                    RecordedBy = currentUserId,
                    RecordedAt = DateTimeOffset.UtcNow
                });

                // Update prescription item dispensed state
                rxItem.IsDispensed = true;
                rxItem.DispensedQuantity += dispenseQty;
                rxItem.DispensedBatchId = availableBatch.Id;

                dispenseRecord.Items.Add(new DispenseItem
                {
                    Id = Guid.NewGuid(),
                    DispenseRecordId = dispenseRecord.Id,
                    PrescriptionItemId = rxItem.Id,
                    DrugBatchId = availableBatch.Id,
                    Quantity = dispenseQty,
                    UnitPrice = availableBatch.Mrp
                });

                // Indian Pharma MRP-Inclusive Reverse GST Calculation
                var lineGross = availableBatch.Mrp * dispenseQty;
                var lineTaxable = Math.Round(lineGross / (1m + (targetDrug.GstRate / 100m)), 2);
                var lineGst = lineGross - lineTaxable;

                pharmSubtotal += lineTaxable;
                pharmTotalGst += lineGst;
                totalAmount += lineGross;

                invoiceLineItems.Add(new InvoiceLineItem
                {
                    Id = Guid.NewGuid(),
                    Description = $"{targetDrug.Name} (Batch: {availableBatch.BatchNumber})",
                    Quantity = dispenseQty,
                    UnitPrice = availableBatch.Mrp,
                    Amount = lineTaxable,
                    TaxAmount = lineGst,
                    GstRate = targetDrug.GstRate,
                    HsnSacCode = targetDrug.HsnCode,
                    HsnCode = targetDrug.HsnCode,
                    DrugBatchId = availableBatch.Id,
                    TaxCategory = TaxCategory.Taxable
                });

                if (targetDrug.ScheduleClass is ScheduleClass.ScheduleH1 or ScheduleClass.ScheduleX)
                {
                    var dispenserUser = await _db.Users.FindAsync([currentUserId], ct);
                    var dispenserName = dispenserUser?.Name ?? "Pharmacist";

                    _db.ControlledSubstanceRegisters.Add(new ControlledSubstanceRegister
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        DispenseRecordId = dispenseRecord.Id,
                        DrugId = targetDrug.Id,
                        ScheduleClass = targetDrug.ScheduleClass,
                        DrugName = targetDrug.Name,
                        BatchNumber = availableBatch.BatchNumber,
                        Quantity = dispenseQty,
                        PatientName = patientName,
                        PatientAddress = patientAddress,
                        PrescriberName = prescriberName!,
                        PrescriberRegNo = prescriberRegNo!,
                        DispensedBy = currentUserId,
                        DispenserName = dispenserName,
                        DispensedAt = DateTimeOffset.UtcNow
                    });
                }
            }

            var currentFy = IndianFinancialYearUtils.GetFinancialYear(DateTimeOffset.UtcNow);
            var maxInvoiceNumber = await _db.Invoices
                .Where(i => i.TenantId == tenantId && i.FinancialYear == currentFy && i.Series == "PHARM")
                .MaxAsync(i => (int?)i.InvoiceNumber, ct) ?? 0;

            var pharmInvoice = new Invoice
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                AppointmentId = prescription.Consultation?.AppointmentId,
                PatientId = prescription.Consultation?.Appointment?.PatientId,
                InvoiceType = InvoiceType.Pharmacy,
                Series = "PHARM",
                FinancialYear = currentFy,
                DocumentType = InvoiceDocumentType.TaxInvoice,
                WalkInCustomerName = req.PatientName ?? prescription.Consultation?.Appointment?.Patient?.Name,
                WalkInCustomerPhone = prescription.Consultation?.Appointment?.Patient?.Phone,
                InvoiceNumber = maxInvoiceNumber + 1,
                Subtotal = pharmSubtotal,
                GstAmount = pharmTotalGst,
                Total = totalAmount,
                PaidAmount = 0.0m,
                BalanceDue = totalAmount,
                Status = InvoiceStatus.Finalized,
                FinalizedAt = DateTimeOffset.UtcNow,
                FinalizedByUserId = currentUserId,
                IdempotencyKey = !string.IsNullOrWhiteSpace(req.IdempotencyKey) ? $"pharm_inv_{req.IdempotencyKey}" : null,
                CreatedAt = DateTimeOffset.UtcNow
            };

            foreach (var li in invoiceLineItems)
            {
                li.InvoiceId = pharmInvoice.Id;
                pharmInvoice.LineItems.Add(li);
            }
            _db.Invoices.Add(pharmInvoice);

            var pharmInvoiceRef = pharmInvoice.FormatInvoiceNumber();

            // Double-entry finance ledger postings
            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.InvoiceFinalized,
                ReferenceType = "Invoice",
                ReferenceId = pharmInvoice.Id,
                ReferenceNumber = pharmInvoiceRef,
                AccountCategory = "AccountsReceivable",
                DebitAmount = totalAmount,
                CreditAmount = 0.0m,
                Narration = $"Pharmacy sales invoice {pharmInvoiceRef} issued for prescription #{prescription.Id:N}",
                PostedByUserId = currentUserId,
                CreatedAt = DateTimeOffset.UtcNow
            });

            _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                EntryType = FinanceEntryType.InvoiceFinalized,
                ReferenceType = "Invoice",
                ReferenceId = pharmInvoice.Id,
                ReferenceNumber = pharmInvoiceRef,
                AccountCategory = "PharmacySales",
                DebitAmount = 0.0m,
                CreditAmount = pharmSubtotal,
                Narration = $"Pharmacy sales revenue for {pharmInvoiceRef}",
                PostedByUserId = currentUserId,
                CreatedAt = DateTimeOffset.UtcNow
            });

            if (pharmTotalGst > 0)
            {
                _db.FinanceLedgerEntries.Add(new FinanceLedgerEntry
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    EntryType = FinanceEntryType.InvoiceFinalized,
                    ReferenceType = "Invoice",
                    ReferenceId = pharmInvoice.Id,
                    ReferenceNumber = pharmInvoiceRef,
                    AccountCategory = "GSTPayable",
                    DebitAmount = 0.0m,
                    CreditAmount = pharmTotalGst,
                    Narration = $"GST payable on pharmacy sales {pharmInvoiceRef}",
                    PostedByUserId = currentUserId,
                    CreatedAt = DateTimeOffset.UtcNow
                });
            }

            // Link to consultation invoice if appointment has one
            if (prescription.Consultation?.AppointmentId is { } apptId)
            {
                var consultationInvoice = await _db.Invoices
                    .FirstOrDefaultAsync(i => i.TenantId == tenantId && i.AppointmentId == apptId && i.Series == "INV", ct);
                if (consultationInvoice != null)
                {
                    consultationInvoice.LinkedPharmacyInvoiceId = pharmInvoice.Id;
                }
            }

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return StatusCode(201, new
            {
                dispenseId = dispenseRecord.Id,
                invoiceId = pharmInvoice.Id,
                invoiceNumber = pharmInvoiceRef,
                prescriptionId = prescription.Id,
                patientName,
                subtotal = pharmSubtotal,
                gstAmount = pharmTotalGst,
                totalAmount = totalAmount,
                balanceDue = pharmInvoice.BalanceDue,
                status = "dispensed",
                createdAt = dispenseRecord.DispensedAt,
                itemCount = dispenseRecord.Items.Count
            });
        });
    }

    [HttpGet("compliance/register")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor")]
    public async Task<IActionResult> GetComplianceRegister(
        [FromQuery] string? schedule,
        [FromQuery] string? startDate,
        [FromQuery] string? endDate,
        [FromQuery] bool exportCsv = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken ct = default)
    {
        var tenantId = TenantId;

        var q = _db.ControlledSubstanceRegisters
            .Include(r => r.Drug)
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .AsQueryable();

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

        var totalCount = exportCsv ? 0 : await q.CountAsync(ct);
        var records = exportCsv
            ? await q.OrderByDescending(r => r.DispensedAt).ToListAsync(ct)
            : await q.OrderByDescending(r => r.DispensedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        if (exportCsv)
        {
            var sb = new StringBuilder();
            sb.AppendLine("ID,Date,ScheduleClass,DrugName,GenericName,BatchNumber,Quantity,PatientName,PatientAddress,PrescribingDoctor,DoctorRegNo,DispensedBy");
            foreach (var r in records)
            {
                sb.AppendLine($"\"{r.Id}\",\"{r.DispensedAt:yyyy-MM-dd HH:mm}\",\"{r.ScheduleClass}\",\"{PharmacyCommon.EscapeCsv(r.DrugName)}\",\"{PharmacyCommon.EscapeCsv(r.Drug?.GenericName ?? string.Empty)}\",\"{r.BatchNumber}\",{r.Quantity},\"{PharmacyCommon.EscapeCsv(r.PatientName)}\",\"{PharmacyCommon.EscapeCsv(r.PatientAddress)}\",\"{PharmacyCommon.EscapeCsv(r.PrescriberName)}\",\"{r.PrescriberRegNo}\",\"{PharmacyCommon.EscapeCsv(r.DispenserName)}\"");
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            return File(bytes, "text/csv", $"statutory_h1_register_{DateTime.UtcNow:yyyyMMdd}.csv");
        }

        return Ok(new
        {
            total = totalCount,
            page,
            pageSize,
            data = records.Select(r => new
            {
                id = r.Id,
                scheduleClass = r.ScheduleClass.ToString(),
                drugName = r.DrugName,
                genericName = r.Drug != null ? r.Drug.GenericName : null,
                batchNumber = r.BatchNumber,
                quantity = r.Quantity,
                patientName = r.PatientName,
                patientAddress = r.PatientAddress,
                prescriberName = r.PrescriberName,
                prescriberRegNo = r.PrescriberRegNo,
                dispenserName = r.DispenserName,
                dispensedAt = r.DispensedAt
            })
        });
    }

    [HttpGet("suppliers")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist")]
    public async Task<IActionResult> GetSuppliers(CancellationToken ct)
    {
        var suppliers = await _db.Suppliers.AsNoTracking().OrderBy(s => s.Name)
            .Select(s => new { id = s.Id, name = s.Name, gstin = s.Gstin, phone = s.Phone, email = s.Email, address = s.Address })
            .ToListAsync(ct);
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
            TenantId = User.GetTenantId() ?? Guid.Empty,
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
}
