using Hospital_CRM.Api.Services;

namespace Hospital_CRM.Tests;

/// <summary>Captures outbound mail so auth tests can read the emailed code without SMTP.</summary>
internal sealed class FakeEmailSender : IEmailSender
{
    public List<(string To, string Subject, string Body)> Sent { get; } = [];

    public Task<bool> SendAsync(string to, string subject, string body, CancellationToken ct)
    {
        Sent.Add((to, subject, body));
        return Task.FromResult(true);
    }
}
