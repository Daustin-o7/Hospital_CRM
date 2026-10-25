using System.Net;
using System.Net.Mail;

namespace Hospital_CRM.Api.Services;

public interface IEmailSender
{
    /// <summary>True when the message was handed to the transport (or logged in Development).</summary>
    Task<bool> SendAsync(string to, string subject, string body, CancellationToken ct);
}

/// <summary>
/// Plain SMTP from the BCL, so the free email-code second factor needs no package.
/// With no Smtp:Host configured, Development logs the message instead of sending it
/// (same trade-off as StubNotificationService) and every other environment fails loudly.
/// </summary>
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration config, IWebHostEnvironment env, ILogger<SmtpEmailSender> logger)
    {
        _config = config;
        _env = env;
        _logger = logger;
    }

    public async Task<bool> SendAsync(string to, string subject, string body, CancellationToken ct)
    {
        var host = _config["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            if (_env.IsDevelopment())
            {
                _logger.LogWarning("[DEV EMAIL] to {To} | {Subject} | {Body}", to, subject, body);
                return true;
            }

            _logger.LogError("Smtp:Host is not configured; cannot email {To}", to);
            return false;
        }

        using var message = new MailMessage(
            _config["Smtp:From"] ?? "no-reply@samstack.ai",
            to,
            subject,
            body);

        using var client = new SmtpClient(host, _config.GetValue("Smtp:Port", 587))
        {
            EnableSsl = _config.GetValue("Smtp:EnableSsl", true),
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        var username = _config["Smtp:Username"];
        if (!string.IsNullOrWhiteSpace(username))
            client.Credentials = new NetworkCredential(username, _config["Smtp:Password"]);

        try
        {
            await client.SendMailAsync(message, ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to email {To}", to);
            return false;
        }
    }
}
