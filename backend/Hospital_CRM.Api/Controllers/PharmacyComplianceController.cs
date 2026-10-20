using System.Data;
using System.Text;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
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

    // [RequireModule] already rejected callers without the pharmacy entitlement.
    private Guid TenantId => User.GetTenantId()!.Value;

    [HttpPost("dispense")]
    [AuthorizeRoles("ClinicAdmin", "Pharmacist", "Doctor")]
    public async Task<IActionResult> DispensePrescription([FromBody] DispensePrescriptionRequest req, CancellationToken ct)
    {
        var prescription = await _db.Prescriptions
            .Include(p => p.Items)
            .Include(p => p.Consultation)
                .ThenInclude(c => c.Appointment)
                    .ThenInclude(a => a.Patient)
            .FirstOrDefaultAsync(p => p.Id == req.PrescriptionId, ct);

        if (prescription == null)
            return NotFound(new { error = "prescription_not_found" });

        var tenantId = TenantId;

        // Idempotency check
        if (!string.IsNullOrWhiteSpace(req.IdempotencyKey))
        {
            var existing = await _db.DispenseRecords
                .FirstOrDefaultAsync(d => d.IdempotencyKey == req.IdempotencyKey, ct);
            if (existing != null)
                return Ok(new { dispenseId = existing.Id, message = "idempotent_duplicate" });
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var currentUserId = User.GetUserId() ?? Guid.Empty;

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            var patientName = req.PatientName ?? prescription.Consultation?.Appointment?.Patient?.Name ?? "Walk-in Patient";
            var patientAddress = req.PatientAddress ?? "Local";

            var prescriptionItems = prescription.Items.ToList();
            var drugNames = prescriptionItems.Select(i => i.MedicineText.Trim().ToLower()).ToList();

            var matchedDrugs = await _db.Drugs
                .Include(d => d.Batches)
                .Where(d => drugNames.Contains(d.Name.ToLower()) || drugNames.Contains(d.GenericName.ToLower()))
                .ToListAsync(ct);

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
            var scheduleH1Items = new List<(DrugBatch Batch, int Qty, Drug Drug)>();

            foreach (var rxItem in prescriptionItems)
            {
                var drugName = rxItem.MedicineText.Trim();
                var matchedDrug = matchedDrugs.FirstOrDefault(d =>
                    d.Name.Equals(drugName, StringComparison.OrdinalIgnoreCase) ||
                    d.GenericName.Equals(drugName, StringComparison.OrdinalIgnoreCase));

                if (matchedDrug == null)
                {
                    dispenseRecord.Items.Add(new DispenseItem
                    {
                        Id = Guid.NewGuid(),
                        DispenseRecordId = dispenseRecord.Id,
                        PrescriptionItemId = rxItem.Id,
                        DrugBatchId = Guid.Empty,
                        Quantity = 1,
                        UnitPrice = 0m
                    });
                    continue;
                }

                var availableBatch = matchedDrug.Batches
                    .Where(b => b.QuantityRemaining > 0 && b.ExpiryDate >= today)
                    .OrderBy(b => b.ExpiryDate)
                    .FirstOrDefault();

                if (availableBatch == null)
                {
                    return BadRequest(new { error = $"no_stock_for_drug: {matchedDrug.Name}", drugName = matchedDrug.Name });
                }

                var dispenseQty = 1;

                // SEC-006: Guard against driving batch stock negative
                if (availableBatch.QuantityRemaining < dispenseQty)
                {
                    return BadRequest(new { error = $"insufficient_stock_for_drug: {matchedDrug.Name}", drugName = matchedDrug.Name, available = availableBatch.QuantityRemaining, requested = dispenseQty });
                }

                if (matchedDrug.ScheduleClass is ScheduleClass.ScheduleH1 or ScheduleClass.NDPS or ScheduleClass.ScheduleX)
                {
                    if (string.IsNullOrWhiteSpace(req.PrescriberName) || string.IsNullOrWhiteSpace(req.PrescriberRegNo))
                    {
                        return BadRequest(new
                        {
                            error = "schedule_h1_prescriber_required",
                            message = "Prescriber name and registration number required for Schedule H1/NDPS/ScheduleX drugs."
                        });
                    }
                    scheduleH1Items.Add((availableBatch, dispenseQty, matchedDrug));
                }

                availableBatch.QuantityRemaining -= dispenseQty;

                dispenseRecord.Items.Add(new DispenseItem
                {
                    Id = Guid.NewGuid(),
                    DispenseRecordId = dispenseRecord.Id,
                    PrescriptionItemId = rxItem.Id,
                    DrugBatchId = availableBatch.Id,
                    Quantity = dispenseQty,
                    UnitPrice = availableBatch.Mrp
                });

                totalAmount += availableBatch.Mrp * dispenseQty;

                if (matchedDrug.ScheduleClass is ScheduleClass.ScheduleH1 or ScheduleClass.NDPS or ScheduleClass.ScheduleX)
                {
                    var dispenserUser = await _db.Users.FindAsync([currentUserId], ct);
                    var dispenserName = dispenserUser?.Name ?? "Pharmacist";

                    _db.ControlledSubstanceRegisters.Add(new ControlledSubstanceRegister
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        DispenseRecordId = dispenseRecord.Id,
                        DrugId = matchedDrug.Id,
                        ScheduleClass = matchedDrug.ScheduleClass,
                        DrugName = matchedDrug.Name,
                        BatchNumber = availableBatch.BatchNumber,
                        Quantity = dispenseQty,
                        PatientName = patientName,
                        PatientAddress = patientAddress,
                        PrescriberName = req.PrescriberName!,
                        PrescriberRegNo = req.PrescriberRegNo!,
                        DispensedBy = currentUserId,
                        DispenserName = dispenserName,
                        DispensedAt = DateTimeOffset.UtcNow
                    });
                }
            }

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            return StatusCode(201, new
            {
                dispenseId = dispenseRecord.Id,
                prescriptionId = prescription.Id,
                patientName,
                totalAmount,
                status = "dispensed",
                createdAt = dispenseRecord.DispensedAt,
                itemCount = dispenseRecord.Items.Count,
                items = dispenseRecord.Items.Select(di =>
                {
                    var rxItem = prescriptionItems.FirstOrDefault(pi => pi.Id == di.PrescriptionItemId);
                    return new
                    {
                        drugName = di.DrugBatchId != Guid.Empty
                            ? (matchedDrugs.FirstOrDefault(d => d.Batches.Any(b => b.Id == di.DrugBatchId))?.Name ?? "Unknown")
                            : (rxItem?.MedicineText ?? "Unknown"),
                        quantity = di.Quantity,
                        unitPrice = di.UnitPrice,
                        batchNumber = di.DrugBatchId != Guid.Empty
                            ? (_db.DrugBatches.FirstOrDefault(b => b.Id == di.DrugBatchId)?.BatchNumber ?? "")
                            : ""
                    };
                })
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
            return File(bytes, "text/csv", $"statutory_controlled_substance_register_{DateTime.UtcNow:yyyyMMdd}.csv");
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
