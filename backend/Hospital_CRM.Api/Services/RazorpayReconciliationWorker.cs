using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Hospital_CRM.Api.Services;

/// <summary>
/// Background worker that reconciles Razorpay payments with a "pending"
/// status by polling the Razorpay GET /payments/{id} API. Handles the
/// FR-18 edge case where a webhook is lost or delayed.
/// Runs on a configurable interval (default 60 min).
/// </summary>
public class RazorpayReconciliationWorker : BackgroundService
{
    private const string ApiBase = "https://api.razorpay.com/v1";
    private readonly ILogger<RazorpayReconciliationWorker> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly HttpClient _httpClient;
    private readonly string _keyId;
    private readonly string _keySecret;
    private readonly TimeSpan _interval;

    public RazorpayReconciliationWorker(
        ILogger<RazorpayReconciliationWorker> logger,
        IConfiguration config,
        IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _keyId = config["Razorpay:KeyId"] ?? "";
        _keySecret = config["Razorpay:KeySecret"] ?? "";
        _httpClient = new HttpClient { BaseAddress = new Uri(ApiBase) };
        var minutes = config.GetValue<int?>("Razorpay:ReconciliationIntervalMinutes") ?? 60;
        _interval = TimeSpan.FromMinutes(minutes);
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_keyId}:{_keySecret}")));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrEmpty(_keyId) || string.IsNullOrEmpty(_keySecret))
        {
            _logger.LogWarning("Razorpay reconciliation worker disabled: Razorpay:KeyId or KeySecret not configured.");
            await Task.Delay(Timeout.Infinite, stoppingToken);
            return;
        }

        _logger.LogInformation("Razorpay reconciliation worker started. Interval: {Interval}", _interval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await ReconcileAsync(stoppingToken); }
            catch (Exception ex) { _logger.LogError(ex, "Error during Razorpay reconciliation cycle"); }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task ReconcileAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HospitalCrmDbContext>();

        var pending = await db.Payments
            .Where(p => p.Status == PaymentStatus.Pending && !string.IsNullOrEmpty(p.RazorpayPaymentId))
            .ToListAsync(ct);

        _logger.LogInformation("Reconciling {Count} pending Razorpay payments", pending.Count);

        foreach (var payment in pending)
        {
            try
            {
                var resp = await _httpClient.GetAsync($"/payments/{payment.RazorpayPaymentId}", ct);
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Razorpay API returned {Status} for payment {Id}", (int)resp.StatusCode, payment.Id);
                    continue;
                }

                var json = await resp.Content.ReadAsStringAsync(ct);
                var rp = JsonSerializer.Deserialize<RazorpayPayment>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (rp is not null && (rp.Status == "captured" || rp.Status == "authorized"))
                {
                    payment.Status = PaymentStatus.Completed;
                    payment.PaidAt = DateTimeOffset.UtcNow;
                    var invoice = await db.Invoices.FindAsync([payment.InvoiceId], ct);
                    if (invoice != null)
                    {
                        invoice.Status = InvoiceStatus.Paid;
                    }
                    await db.SaveChangesAsync(ct);
                    _logger.LogInformation("Payment {Id} marked paid via reconciliation", payment.Id);
                }
            }
            catch (Exception ex) { _logger.LogError(ex, "Error reconciling payment {Id}", payment.Id); }
        }
    }
}

/// <summary>
/// Minimal model of the Razorpay payment response fields we care about.
/// </summary>
internal class RazorpayPayment
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("amount")] public long Amount { get; set; }
    [JsonPropertyName("currency")] public string? Currency { get; set; }
}
