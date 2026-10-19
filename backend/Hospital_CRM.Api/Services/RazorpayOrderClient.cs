using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Hospital_CRM.Api.Services;

/// <summary>
/// B2/F6: creates a Razorpay order so the webhook has an order id to match on.
/// Optional by decision D7 — when <c>Razorpay:KeyId</c>/<c>KeySecret</c> are unset the
/// caller returns 503 instead of handing the client a fake checkout URL.
/// </summary>
public class RazorpayOrderClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;

    public RazorpayOrderClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        _config = config;
        _http.BaseAddress ??= new Uri("https://api.razorpay.com/v1/");
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_config["Razorpay:KeyId"]) &&
        !string.IsNullOrWhiteSpace(_config["Razorpay:KeySecret"]);

    public string? KeyId => _config["Razorpay:KeyId"];

    public async Task<string?> CreateOrderAsync(decimal amountRupees, string receipt, CancellationToken ct)
    {
        var keyId = _config["Razorpay:KeyId"];
        var keySecret = _config["Razorpay:KeySecret"];
        if (string.IsNullOrWhiteSpace(keyId) || string.IsNullOrWhiteSpace(keySecret))
            return null;

        using var request = new HttpRequestMessage(HttpMethod.Post, "orders")
        {
            Content = JsonContent.Create(new
            {
                amount = (int)Math.Round(amountRupees * 100m),
                currency = "INR",
                receipt,
                payment_capture = 1
            })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic", Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{keyId}:{keySecret}")));

        using var response = await _http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            return null;

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() : null;
    }
}
