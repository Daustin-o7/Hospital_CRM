using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;

namespace Hospital_CRM.Api.Services;

public class StubNotificationService : INotificationService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<StubNotificationService> _logger;

    public StubNotificationService(IServiceScopeFactory scopeFactory, ILogger<StubNotificationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task SendAppointmentConfirmationAsync(Guid appointmentId, string patientPhone, string clinicName, DateTime dateTime)
    {
        var message = $"Your appointment at {clinicName} is confirmed for {dateTime:dd MMM yyyy hh:mm tt}.";
        await LogNotificationAsync(appointmentId, patientPhone, message, "appointment_confirmation");
    }

    public async Task SendAppointmentReminderAsync(Guid appointmentId, string patientPhone, string clinicName, DateTime dateTime)
    {
        var message = $"Reminder: You have an appointment at {clinicName} tomorrow at {dateTime:hh:mm tt}.";
        await LogNotificationAsync(appointmentId, patientPhone, message, "appointment_reminder");
    }

    private async Task LogNotificationAsync(Guid appointmentId, string phone, string message, string template)
    {
        _logger.LogInformation("[STUB] WhatsApp to {Phone}: {Message}", phone, message);

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HospitalCrmDbContext>();

        var log = new NotificationLog
        {
            Id = Guid.NewGuid(),
            AppointmentId = appointmentId,
            Channel = NotificationChannel.WhatsApp,
            Template = template,
            Status = NotificationStatus.Sent,
            SentAt = DateTimeOffset.UtcNow
        };

        db.NotificationLogs.Add(log);
        await db.SaveChangesAsync();
    }
}