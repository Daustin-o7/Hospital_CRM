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

public record SyncItemResultDto(
    Guid Id,
    string? IdempotencyKey,
    string Status,
    string Type,
    string? Reason = null
);

public record SyncPushResponse(
    int Synced,
    int Skipped,
    List<SyncItemResultDto> Results
);

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class SyncController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;
    private readonly IPatientSearchService _search;
    private readonly ILogger<SyncController> _logger;

    private const int MaxPayloadLength = 65536; // 64 KB

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
            return Ok(new SyncPushResponse(0, 0, new List<SyncItemResultDto>()));
        }

        var results = new List<SyncItemResultDto>();
        var synced = 0;
        var skipped = 0;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            foreach (var item in request.Items)
            {
                if (string.IsNullOrWhiteSpace(item.IdempotencyKey))
                {
                    results.Add(new SyncItemResultDto(item.Id, null, "rejected", "unknown", "Missing IdempotencyKey"));
                    skipped++;
                    continue;
                }

                if (item.PayloadJson != null && item.PayloadJson.Length > MaxPayloadLength)
                {
                    results.Add(new SyncItemResultDto(item.Id, item.IdempotencyKey, "rejected", "payload_too_large", "Payload exceeds 64KB limit"));
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
                            PatientSyncPayload? payload = null;
                            try
                            {
                                payload = JsonSerializer.Deserialize<PatientSyncPayload>(item.PayloadJson ?? "{}", new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                            }
                            catch (Exception)
                            {
                                results.Add(new SyncItemResultDto(item.Id, item.IdempotencyKey, "invalid_payload", "patient", "Malformed JSON payload"));
                                skipped++;
                                continue;
                            }

                            // Check for duplicate phone number before creating patient
                            if (payload != null && !string.IsNullOrWhiteSpace(payload.Phone) && await _db.Patients.AnyAsync(p => p.Phone == payload.Phone.Trim(), ct))
                            {
                                results.Add(new SyncItemResultDto(item.Id, item.IdempotencyKey, "phone_conflict", "patient", "A patient with this phone already exists"));
                                skipped++;
                                continue;
                            }

                            if (payload != null && !string.IsNullOrWhiteSpace(payload.Name) && !string.IsNullOrWhiteSpace(payload.Phone))
                            {
                                var patient = new Patient
                                {
                                    Id = item.Id != Guid.Empty ? item.Id : Guid.NewGuid(),
                                    TenantId = Guid.Empty,
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

                                results.Add(new SyncItemResultDto(patient.Id, item.IdempotencyKey, "created", "patient"));
                                synced++;
                            }
                            else
                            {
                                results.Add(new SyncItemResultDto(item.Id, item.IdempotencyKey, "invalid_payload", "patient", "Patient Name and Phone are required"));
                                skipped++;
                            }
                        }
                        else
                        {
                            // Idempotent duplicate: acknowledge success
                            results.Add(new SyncItemResultDto(existingPatient.Id, item.IdempotencyKey, "idempotent_duplicate", "patient"));
                            synced++;
                        }
                        break;

                    case 2: // Invoice / Billing
                        var existingInvoice = await _db.Invoices
                            .FirstOrDefaultAsync(i => i.IdempotencyKey == item.IdempotencyKey || i.Id == item.Id, ct);

                        if (existingInvoice is null)
                        {
                            InvoiceSyncPayload? payload = null;
                            try
                            {
                                payload = JsonSerializer.Deserialize<InvoiceSyncPayload>(item.PayloadJson ?? "{}", new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                            }
                            catch (Exception)
                            {
                                results.Add(new SyncItemResultDto(item.Id, item.IdempotencyKey, "invalid_payload", "invoice", "Malformed JSON payload"));
                                skipped++;
                                continue;
                            }

                            var hasValidCustomer = (payload?.PatientId.HasValue == true && payload.PatientId.Value != Guid.Empty)
                                                || !string.IsNullOrWhiteSpace(payload?.WalkInCustomerName);

                            if (payload != null
                                && hasValidCustomer
                                && payload.Subtotal >= 0
                                && payload.GstAmount >= 0
                                && payload.Total > 0
                                && payload.Total == payload.Subtotal + payload.GstAmount)
                            {
                                var invoice = new Invoice
                                {
                                    Id = item.Id != Guid.Empty ? item.Id : Guid.NewGuid(),
                                    TenantId = Guid.Empty,
                                    PatientId = payload.PatientId.HasValue && payload.PatientId.Value != Guid.Empty ? payload.PatientId.Value : null,
                                    WalkInCustomerName = payload.WalkInCustomerName?.Trim(),
                                    WalkInCustomerPhone = payload.WalkInCustomerPhone?.Trim(),
                                    Subtotal = payload.Subtotal,
                                    GstAmount = payload.GstAmount,
                                    Total = payload.Total,
                                    Status = InvoiceStatus.Paid,
                                    IdempotencyKey = item.IdempotencyKey,
                                    CreatedAt = item.CreatedAt != default ? item.CreatedAt : DateTimeOffset.UtcNow
                                };

                                _db.Invoices.Add(invoice);
                                await _db.SaveChangesAsync(ct);

                                results.Add(new SyncItemResultDto(invoice.Id, item.IdempotencyKey, "created", "invoice"));
                                synced++;
                            }
                            else
                            {
                                results.Add(new SyncItemResultDto(item.Id, item.IdempotencyKey, "invalid_payload", "invoice", "Invoice requires either PatientId or WalkInCustomerName, non-negative amounts, and Total = Subtotal + GstAmount"));
                                skipped++;
                            }
                        }
                        else
                        {
                            results.Add(new SyncItemResultDto(existingInvoice.Id, item.IdempotencyKey, "idempotent_duplicate", "invoice"));
                            synced++;
                        }
                        break;

                    default:
                        results.Add(new SyncItemResultDto(item.Id, item.IdempotencyKey, "unsupported_type", item.Type.ToString(), $"Unsupported sync item type {item.Type}"));
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

        return Ok(new SyncPushResponse(synced, skipped, results));
    }

    private static Gender ParseGender(string? g) => g?.ToLowerInvariant() switch
    {
        "male" or "m" => Gender.Male,
        "female" or "f" => Gender.Female,
        _ => Gender.Other
    };
}
