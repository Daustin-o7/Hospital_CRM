using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Domain.Services;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

/// <summary>
/// B2 / D7: the clinic's own PSP (Paytm Business, PhonePe Business) notifies SAMSTACK
/// directly. SAMSTACK is a software ledger and never holds patient funds.
///
/// Tenant routing for the anonymous webhook is the unguessable path token on the
/// integration row, then the signature is verified with that tenant's secret. A
/// webhook signed with tenant B's secret therefore never validates for tenant A.
/// </summary>
[ApiController]
[Route("api/v1")]
public class PaymentIntegrationsController : ControllerBase
{
    private static readonly string[] PaymentProviders = ["paytm", "phonepe", "razorpay"];
    private static readonly string[] AllProviders = ["paytm", "phonepe", "razorpay", "whatsapp"];

    private readonly HospitalCrmDbContext _db;
    private readonly ISecretProtector _secretProtector;
    private readonly IConfiguration _config;
    private readonly ILogger<PaymentIntegrationsController> _logger;

    public PaymentIntegrationsController(
        HospitalCrmDbContext db,
        ISecretProtector secretProtector,
        IConfiguration config,
        ILogger<PaymentIntegrationsController> logger)
    {
        _db = db;
        _secretProtector = secretProtector;
        _config = config;
        _logger = logger;
    }

    // ----- Clinic Admin connect screen -----

    [HttpGet("integrations/payments")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var tenantId = User.GetTenantId();
        if (tenantId is null) return Forbid();

        var rows = await _db.TenantIntegrations
            .Where(i => i.TenantId == tenantId.Value)
            .OrderBy(i => i.Provider)
            .ToListAsync(ct);

        var baseUrl = PublicBaseUrl();
        return Ok(rows.Select(i => new
        {
            provider = i.Provider,
            merchantId = i.MerchantId,
            enabled = i.Enabled,
            hasSecret = !string.IsNullOrEmpty(i.SecretProtected),
            webhookUrl = PaymentProviders.Contains(i.Provider) && !string.IsNullOrEmpty(i.WebhookPathToken)
                ? $"{baseUrl}/api/v1/webhooks/payments/{i.Provider}/{i.WebhookPathToken}"
                : null,
            lastVerifiedAt = i.LastVerifiedAt
        }));
    }

    [HttpPut("integrations/payments/{provider}")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Upsert(string provider, [FromBody] UpsertIntegrationRequest request, CancellationToken ct)
    {
        provider = (provider ?? string.Empty).Trim().ToLowerInvariant();
        if (!AllProviders.Contains(provider))
            return BadRequest(new { error = "unknown_provider" });

        var tenantId = User.GetTenantId();
        if (tenantId is null) return Forbid();

        if (string.IsNullOrWhiteSpace(request.Secret) && string.IsNullOrWhiteSpace(request.MerchantId))
            return BadRequest(new { error = "merchant_id_or_secret_required" });

        var integration = await _db.TenantIntegrations
            .FirstOrDefaultAsync(i => i.TenantId == tenantId.Value && i.Provider == provider, ct);

        if (integration is null)
        {
            integration = new TenantIntegration
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Value,
                Provider = provider,
                WebhookPathToken = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(24))
            };
            _db.TenantIntegrations.Add(integration);
        }

        if (!string.IsNullOrWhiteSpace(request.MerchantId))
            integration.MerchantId = request.MerchantId.Trim();

        // Write-only: a blank secret means "keep the existing one".
        if (!string.IsNullOrWhiteSpace(request.Secret))
            integration.SecretProtected = _secretProtector.Protect(request.Secret);

        if (request.Enabled.HasValue)
            integration.Enabled = request.Enabled.Value;

        integration.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Integration {Provider} configured for tenant {TenantId}", provider, tenantId.Value);

        return Ok(new
        {
            provider = integration.Provider,
            merchantId = integration.MerchantId,
            enabled = integration.Enabled,
            hasSecret = !string.IsNullOrEmpty(integration.SecretProtected),
            webhookUrl = PaymentProviders.Contains(provider)
                ? $"{PublicBaseUrl()}/api/v1/webhooks/payments/{provider}/{integration.WebhookPathToken}"
                : null
        });
    }

    [HttpDelete("integrations/payments/{provider}")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Remove(string provider, CancellationToken ct)
    {
        var tenantId = User.GetTenantId();
        if (tenantId is null) return Forbid();

        provider = (provider ?? string.Empty).Trim().ToLowerInvariant();
        var integration = await _db.TenantIntegrations
            .FirstOrDefaultAsync(i => i.TenantId == tenantId.Value && i.Provider == provider, ct);
        if (integration is null) return NotFound(new { error = "integration_not_found" });

        _db.TenantIntegrations.Remove(integration);
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "integration_removed" });
    }

    /// <summary>
    /// Configuration self-test. Without a merchant API credential there is nothing to
    /// call at the PSP, so this proves what can be proven locally: the stored secret
    /// decrypts, and a probe payload signed with it passes the same verifier the
    /// webhook uses. A true round-trip still needs the merchant account.
    /// </summary>
    [HttpPost("integrations/payments/{provider}/verify")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Verify(string provider, CancellationToken ct)
    {
        var tenantId = User.GetTenantId();
        if (tenantId is null) return Forbid();

        provider = (provider ?? string.Empty).Trim().ToLowerInvariant();
        var integration = await _db.TenantIntegrations
            .FirstOrDefaultAsync(i => i.TenantId == tenantId.Value && i.Provider == provider, ct);
        if (integration is null) return NotFound(new { error = "integration_not_found" });

        var secret = _secretProtector.Unprotect(integration.SecretProtected);
        if (string.IsNullOrEmpty(secret))
            return UnprocessableEntity(new { error = "secret_missing_or_unreadable" });

        var probe = "{\"probe\":true}";
        var signature = PaymentWebhookCodec.SignHmac(secret, probe);
        if (!PaymentWebhookCodec.Verify(provider, secret, probe, signature))
            return UnprocessableEntity(new { error = "signature_verification_failed" });

        integration.LastVerifiedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { verified = true, lastVerifiedAt = integration.LastVerifiedAt });
    }

    // ----- Unmatched payments (never dropped) -----

    [HttpGet("integrations/payments/unmatched")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> ListUnmatched(CancellationToken ct)
    {
        var tenantId = User.GetTenantId();
        if (tenantId is null) return Forbid();

        var rows = await _db.ProcessedWebhookEvents
            .Where(e => e.TenantId == tenantId.Value && e.Status == ProcessedWebhookEvent.Unmatched)
            .OrderByDescending(e => e.ReceivedAt)
            .Take(100)
            .Select(e => new
            {
                id = e.Id,
                provider = e.Provider,
                amount = e.Amount,
                utr = e.Utr,
                reference = e.Reference,
                receivedAt = e.ReceivedAt
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("integrations/payments/unmatched/{id:guid}/match")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> MatchUnmatched(Guid id, [FromBody] MatchUnmatchedRequest request, CancellationToken ct)
    {
        var tenantId = User.GetTenantId();
        if (tenantId is null) return Forbid();

        var evt = await _db.ProcessedWebhookEvents
            .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId.Value && e.Status == ProcessedWebhookEvent.Unmatched, ct);
        if (evt is null) return NotFound(new { error = "unmatched_payment_not_found" });

        var invoice = await _db.Invoices
            .FirstOrDefaultAsync(i => i.Id == request.InvoiceId && i.TenantId == tenantId.Value, ct);
        if (invoice is null) return NotFound(new { error = "invoice_not_found" });
        if (invoice.Status == InvoiceStatus.Paid) return BadRequest(new { error = "invoice_already_paid" });

        var payment = CloseInvoice(invoice, tenantId.Value, evt.Amount, evt.Utr);
        evt.Status = ProcessedWebhookEvent.Processed;
        evt.PaymentId = payment.Id;

        await _db.SaveChangesAsync(ct);
        return Ok(new { status = "matched", paymentId = payment.Id });
    }

    // ----- B2.9 Android notification bridge (fallback) -----

    /// <summary>
    /// Fallback for clinics whose UPI ID exposes no PSP webhook: the receptionist's
    /// Android device reads the bank SMS / soundbox notification and posts it here.
    /// The tenant is taken from the session, never from the payload, and the raw
    /// notification text is never trusted for amounts beyond what the body states.
    /// There is no HMAC here because the device holds no merchant secret; the JWT
    /// (a clinic user on that device) is the credential.
    /// </summary>
    [HttpPost("integrations/payments/bridge/notifications")]
    [AuthorizeRoles("ClinicAdmin", "Receptionist")]
    public async Task<IActionResult> IngestDeviceNotification([FromBody] DevicePaymentNotification request, CancellationToken ct)
    {
        var tenantId = User.GetTenantId();
        if (tenantId is null) return Forbid();

        if (string.IsNullOrWhiteSpace(request.EventId) || request.Amount is null or <= 0)
            return BadRequest(new { error = "event_id_and_amount_required" });

        var provider = ("bridge:" + (request.Source ?? "unknown").Trim().ToLowerInvariant());
        if (provider.Length > 50)
            return BadRequest(new { error = "source_too_long" });

        var already = await _db.ProcessedWebhookEvents
            .AnyAsync(e => e.TenantId == tenantId.Value && e.Provider == provider && e.EventId == request.EventId, ct);
        if (already)
            return Ok(new { status = "duplicate" });

        var evt = new PaymentEvent(request.EventId, request.Amount, request.Utr, request.Reference);
        var invoice = await MatchInvoiceAsync(tenantId.Value, evt, ct);

        var record = new ProcessedWebhookEvent
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            Provider = provider,
            EventId = request.EventId,
            Amount = request.Amount,
            Utr = request.Utr,
            Reference = request.Reference,
            RawPayload = request.RawText is { Length: > 0 } raw ? (raw.Length > 4000 ? raw[..4000] : raw) : null,
            ReceivedAt = DateTimeOffset.UtcNow
        };

        if (invoice is null)
        {
            record.Status = ProcessedWebhookEvent.Unmatched;
            _db.ProcessedWebhookEvents.Add(record);
            await _db.SaveChangesAsync(ct);
            return Ok(new { status = "unmatched" });
        }

        var payment = CloseInvoice(invoice, tenantId.Value, request.Amount, request.Utr);
        record.Status = ProcessedWebhookEvent.Processed;
        record.PaymentId = payment.Id;
        _db.ProcessedWebhookEvents.Add(record);
        await _db.SaveChangesAsync(ct);

        return Ok(new { status = "ok", paymentId = payment.Id });
    }

    /// <summary>
    /// The single place a payment closes an invoice, shared by the PSP webhook, the
    /// device bridge and the manual review queue.
    /// </summary>
    private Payment CloseInvoice(Invoice invoice, Guid tenantId, decimal? amount, string? utr)
    {
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            InvoiceId = invoice.Id,
            Method = PaymentMethod.UPI,
            Amount = amount ?? invoice.Total,
            Utr = utr,
            Status = PaymentStatus.Completed,
            PaidAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.Payments.Add(payment);
        invoice.Status = InvoiceStatus.Paid;
        invoice.UpdatedAt = DateTimeOffset.UtcNow;
        return payment;
    }

    // ----- PSP webhook receiver (anonymous) -----

    [HttpPost("webhooks/payments/{provider}/{pathToken}")]
    [AllowAnonymous]
    public async Task<IActionResult> Receive(string provider, string pathToken, CancellationToken ct)
    {
        provider = (provider ?? string.Empty).Trim().ToLowerInvariant();
        if (!PaymentProviders.Contains(provider))
            return NotFound(new { error = "unknown_provider" });

        // No RLS on TenantIntegrations by design: this lookup happens before any tenant
        // context exists. It is the routing step that establishes the tenant.
        var integration = await _db.TenantIntegrations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.WebhookPathToken == pathToken && i.Provider == provider, ct);

        if (integration is null || !integration.Enabled)
            return NotFound(new { error = "integration_not_found" });

        var secret = _secretProtector.Unprotect(integration.SecretProtected);
        if (string.IsNullOrEmpty(secret))
            return StatusCode(503, new { error = "integration_secret_unavailable" });

        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);

        var signature = GetSignatureHeader();
        if (string.IsNullOrWhiteSpace(signature) || !PaymentWebhookCodec.Verify(provider, secret, body, signature))
            return BadRequest(new { error = "invalid_webhook_signature" });

        var evt = PaymentWebhookCodec.TryParse(provider, body);
        if (evt is null)
            return Ok(new { status = "ignored" }); // signed but no payment in the payload

        // RLS is enabled on Invoices/Payments/ProcessedWebhookEvents, and an anonymous
        // request has no tenant. Set the tenant for this transaction only (SET LOCAL).
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);
        await _db.Database.ExecuteSqlAsync(
            $"SELECT set_config('app.current_tenant_id', {integration.TenantId.ToString()}, true), set_config('app.is_platform_admin', 'false', true)", ct);

        try
        {
            var already = await _db.ProcessedWebhookEvents.IgnoreQueryFilters()
                .AnyAsync(e => e.Provider == provider && e.EventId == evt.EventId, ct);
            if (already)
            {
                await transaction.CommitAsync(ct);
                return Ok(new { status = "duplicate" });
            }

            var invoice = await MatchInvoiceAsync(integration.TenantId, evt, ct);

            var record = new ProcessedWebhookEvent
            {
                Id = Guid.NewGuid(),
                TenantId = integration.TenantId,
                Provider = provider,
                EventId = evt.EventId,
                Amount = evt.Amount,
                Utr = evt.Utr,
                Reference = evt.Reference,
                RawPayload = body.Length > 4000 ? body[..4000] : body,
                ReceivedAt = DateTimeOffset.UtcNow
            };

            if (invoice is null)
            {
                record.Status = ProcessedWebhookEvent.Unmatched;
                _db.ProcessedWebhookEvents.Add(record);
                await _db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                _logger.LogWarning("Unmatched {Provider} payment (event {EventId}) for tenant {TenantId}",
                    provider, evt.EventId, integration.TenantId);
                return Ok(new { status = "unmatched" });
            }

            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = integration.TenantId,
                InvoiceId = invoice.Id,
                Method = PaymentMethod.UPI,
                Amount = evt.Amount ?? invoice.Total,
                Utr = evt.Utr,
                Status = PaymentStatus.Completed,
                PaidAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow
            };
            _db.Payments.Add(payment);

            invoice.Status = InvoiceStatus.Paid;
            invoice.UpdatedAt = DateTimeOffset.UtcNow;

            record.Status = ProcessedWebhookEvent.Processed;
            record.PaymentId = payment.Id;
            _db.ProcessedWebhookEvents.Add(record);

            await _db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);

            _logger.LogInformation("Auto-closed invoice {InvoiceId} from {Provider} webhook for tenant {TenantId}",
                invoice.Id, provider, integration.TenantId);

            return Ok(new { status = "ok" });
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // Concurrent delivery of the same event: the other request won, this one is a no-op.
            await transaction.RollbackAsync(ct);
            return Ok(new { status = "duplicate" });
        }
    }

    // ----- matching / verification helpers -----

    private async Task<Invoice?> MatchInvoiceAsync(Guid tenantId, PaymentEvent evt, CancellationToken ct)
    {
        if (evt.Amount is null or <= 0)
            return null;

        var amount = evt.Amount.Value;
        var since = DateTimeOffset.UtcNow.AddDays(-7);

        var candidates = await _db.Invoices.IgnoreQueryFilters()
            .Where(i => i.TenantId == tenantId
                        && i.Status != InvoiceStatus.Paid
                        && i.Status != InvoiceStatus.Cancelled
                        && i.Total == amount
                        && i.CreatedAt >= since)
            .OrderByDescending(i => i.CreatedAt)
            .Take(10)
            .ToListAsync(ct);

        if (candidates.Count == 0)
            return null;

        // A reference that carries the invoice number wins over amount-only matching.
        if (!string.IsNullOrWhiteSpace(evt.Reference))
        {
            var byReference = candidates.FirstOrDefault(i =>
                evt.Reference!.Contains(i.InvoiceNumber.ToString(), StringComparison.OrdinalIgnoreCase));
            if (byReference is not null)
                return byReference;
        }

        return candidates.Count == 1 ? candidates[0] : null;
    }

    private string GetSignatureHeader()
    {
        string[] names = ["X-Paytm-Signature", "X-PhonePe-Signature", "X-Webhook-Signature", "X-Verify", "X-Razorpay-Signature"];
        foreach (var name in names)
        {
            if (Request.Headers.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value))
                return value.ToString();
        }
        return string.Empty;
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23505" };

    private string PublicBaseUrl() =>
        _config["App:PublicBaseUrl"]?.TrimEnd('/')
        ?? $"{Request.Scheme}://{Request.Host}";
}

public record UpsertIntegrationRequest(
    [MaxLength(255)] string? MerchantId,
    [MaxLength(500)] string? Secret,
    bool? Enabled);

public record MatchUnmatchedRequest(Guid InvoiceId);

/// <summary>
/// B2.9 bridge payload. Amount comes from the parsed bank SMS / soundbox text on the
/// device; the server still matches it against an open invoice and never trusts the
/// device for the tenant.
/// </summary>
public record DevicePaymentNotification(
    string EventId,
    decimal? Amount,
    string? Utr = null,
    string? Reference = null,
    string? Source = null,
    string? RawText = null);
