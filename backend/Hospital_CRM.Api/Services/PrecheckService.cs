using System.Security.Cryptography;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Services;

public class PrecheckService
{
    private readonly HospitalCrmDbContext _db;
    private readonly IConfiguration _config;

    public PrecheckService(HospitalCrmDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    /// <summary>
    /// Returns (plaintextToken, submission) for the caller to add to the DbContext
    /// and SaveChanges in the same transaction. The caller owns the commit.
    /// </summary>
    public async Task<(string? plaintextToken, PrecheckSubmission? submission)> GenerateForAppointmentAsync(
        Guid appointmentId, Guid tenantId, CancellationToken ct = default)
    {
        var appointment = await _db.Appointments
            .FirstOrDefaultAsync(a => a.Id == appointmentId, ct);
        if (appointment is null) throw new InvalidOperationException("appointment_not_found");

        if (appointment.Type == AppointmentType.WalkIn)
            return (null, null);

        var slotDateTime = appointment.Date.ToDateTime(TimeOnly.Parse(appointment.TimeSlot));
        if (slotDateTime - DateTimeOffset.UtcNow < TimeSpan.FromHours(2))
            return (null, null);

        var (plaintext, hash) = GenerateToken();

        var submission = new PrecheckSubmission
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            AppointmentId = appointmentId,
            TokenHash = hash,
            ExpiresAt = new DateTimeOffset(slotDateTime, TimeSpan.Zero),
            CreatedAt = DateTimeOffset.UtcNow
        };
        // Caller adds to DbContext and calls SaveChanges — no SaveChanges here.
        return (plaintext, submission);
    }

    public string BuildLink(string token) =>
        $"{_config["App:PublicBaseUrl"]?.TrimEnd('/') ?? "http://localhost:5173"}/precheck/{token}";

    private static (string plaintext, string hash) GenerateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var plaintext = Convert.ToBase64String(bytes)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var hash = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(plaintext))).ToLowerInvariant();
        return (plaintext, hash);
    }
}