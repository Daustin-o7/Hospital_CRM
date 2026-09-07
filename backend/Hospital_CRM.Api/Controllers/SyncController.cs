using System.Text.Json;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services.Typesense;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

public record SyncPushItem(
    Guid Id,
    int Type, // 1 = Patient, 2 = Invoice
    string? IdempotencyKey,
    string PayloadJson,
    DateTimeOffset CreatedAt
);

public record SyncPushRequest(
    List<SyncPushItem> Items
);

public record PatientSyncPayload(
    string Name,
    string Phone,
    DateOnly? Dob,
    int? ApproxAge,
    string? Gender,
    string? Address
);

public record InvoiceSyncPayload(
    Guid? PatientId,
    decimal Subtotal,
    decimal GstAmount,
    decimal Total,
    string? PaymentMethod,
    string? WalkInCustomerName,
    string? WalkInCustomerPhone
);

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class SyncController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IPatientSearchService _search;
    private readonly ILogger<SyncController> _logger;

    public SyncController(HospitalCrmDbContext db, IPatientSearchService search, ILogger<SyncController> logger)
    {
        _db = db;
        _search = search;
        _logger = logger;
    }

    [HttpPost("push")]
    [AuthorizeRoles("ClinicAdmin", "Receptionist", "Doctor", "Staff")]
    public async Task<IActionResult> Push([FromBody] SyncPushRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        if (request?.Items == null || request.Items.Count == 0)
        {
            return Ok(new { synced = 0, skipped = 0, results = Array.Empty<object>() });
        }

        var results = new List<object>();
        var synced = 0;
        var skipped = 0;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            foreach (var item in request.Items)
            {
                if (string.IsNullOrWhiteSpace(item.IdempotencyKey))
                {
                    results.Add(new { id = item.Id, status = "rejected", reason = "Missing IdempotencyKey" });
                    skipped++;
                    continue;
                }

                switch (item.Type)
                {
                    case 1: // Patient Registration
                        var existingPatient = await _db.Patients
                            .FirstOrDefaultAsync(p => p.IdempotencyKey == item.IdempotencyKey, ct);

                        if (existingPatient is null)
                        {
                            var payload = JsonSerializer.Deserialize<PatientSyncPayload>(item.PayloadJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                            // Check for duplicate phone number before creating patient
                            if (payload != null && !string.IsNullOrWhiteSpace(payload.Phone) && await _db.Patients.AnyAsync(p => p.Phone == payload.Phone, ct))
                            {
                                results.Add(new { id = item.Id, idempotencyKey = item.IdempotencyKey, status = "phone_conflict", type = "patient" });
                                skipped++;
                                continue;
                            }

                            if (payload != null && !string.IsNullOrWhiteSpace(payload.Name) && !string.IsNullOrWhiteSpace(payload.Phone))
                            {
                                var patient = new Patient
                                {
                                    Id = item.Id != Guid.Empty ? item.Id : Guid.NewGuid(),
                                    Name = payload.Name.Trim(),
                                    Phone = payload.Phone.Trim(),
                                    DobHasValue = payload.Dob.HasValue,
                                    Dob = payload.Dob,
                                    ApproxAge = payload.ApproxAge,
                                    Gender = ParseGender(payload.Gender),
                                    Address = payload.Address?.Trim(),
                                    CreatedBy = userId.Value,
                                    CreatedAt = item.CreatedAt != default ? item.CreatedAt : DateTimeOffset.UtcNow,
                                    IdempotencyKey = item.IdempotencyKey
                                };

                                _db.Patients.Add(patient);
                                await _db.SaveChangesAsync(ct);
                                _ = _search.IndexAsync(patient, CancellationToken.None);

                                results.Add(new { id = patient.Id, idempotencyKey = item.IdempotencyKey, status = "created", type = "patient" });
                                synced++;
                            }
                            else
                            {
                                results.Add(new { id = item.Id, idempotencyKey = item.IdempotencyKey, status = "invalid_payload", type = "patient" });
                                skipped++;
                            }
                        }
                        else
                        {
                            // Idempotent duplicate: acknowledge success
                            results.Add(new { id = existingPatient.Id, idempotencyKey = item.IdempotencyKey, status = "idempotent_duplicate", type = "patient" });
                            synced++;
                        }
                        break;

                    case 2: // Invoice / Billing
                        var existingInvoice = await _db.Invoices
                            .FirstOrDefaultAsync(i => i.IdempotencyKey == item.IdempotencyKey || i.Id == item.Id, ct);

                        if (existingInvoice is null)
                        {
                            var payload = JsonSerializer.Deserialize<InvoiceSyncPayload>(item.PayloadJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                            if (payload != null
        && payload.PatientId.HasValue
        && payload.Subtotal >= 0
        && payload.GstAmount >= 0
        && payload.Total > 0
        && !string.IsNullOrWhiteSpace(payload.WalkInCustomerName)
        && payload.Total == payload.Subtotal + payload.GstAmount)
                            {
                                var invoice = new Invoice
                                {
                                    Id = item.Id != Guid.Empty ? item.Id : Guid.NewGuid(),
                                    PatientId = payload.PatientId.Value,
                                    WalkInCustomerName = payload.WalkInCustomerName,
                                    WalkInCustomerPhone = payload.WalkInCustomerPhone,
                                    Subtotal = payload.Subtotal,
                                    GstAmount = payload.GstAmount,
                                    Total = payload.Total,
                                    Status = InvoiceStatus.Paid,
                                    IdempotencyKey = item.IdempotencyKey,
                                    CreatedAt = item.CreatedAt != default ? item.CreatedAt : DateTimeOffset.UtcNow
                                };

                                _db.Invoices.Add(invoice);
                                await _db.SaveChangesAsync(ct);

                                results.Add(new { id = invoice.Id, idempotencyKey = item.IdempotencyKey, status = "created", type = "invoice" });
                                synced++;
                            }
                            else
                            {
                                results.Add(new { id = item.Id, idempotencyKey = item.IdempotencyKey, status = "invalid_payload", type = "invoice" });
                                skipped++;
                            }
                        }
                        else
                        {
                            results.Add(new { id = existingInvoice.Id, idempotencyKey = item.IdempotencyKey, status = "idempotent_duplicate", type = "invoice" });
                            synced++;
                        }
                        break;

                    default:
                        results.Add(new { id = item.Id, status = "unsupported_type", type = item.Type });
                        skipped++;
                        break;
                }
            }

            await tx.CommitAsync(ct);
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            _logger.LogError(ex, "Error processing sync push batch");
            return StatusCode(500, new { error = "sync_batch_failed", message = ex.Message });
        }

        return Ok(new { synced, skipped, results });
    }

    private static Gender ParseGender(string? g) => g?.ToLowerInvariant() switch
    {
        "male" or "m" => Gender.Male,
        "female" or "f" => Gender.Female,
        _ => Gender.Other
    };
}
