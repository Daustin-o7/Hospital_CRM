using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Services;

public class ReminderSchedulerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ReminderSchedulerService> _logger;
    private readonly PeriodicTimer _timer;

    public ReminderSchedulerService(IServiceProvider serviceProvider, ILogger<ReminderSchedulerService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _timer = new PeriodicTimer(TimeSpan.FromHours(1));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (await _timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await SendRemindersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending reminders");
            }
        }
    }

    private async Task SendRemindersAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HospitalCrmDbContext>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var precheckService = scope.ServiceProvider.GetRequiredService<PrecheckService>();

        var tomorrow = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));

        var appointments = await db.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Clinic)
            .Where(a => a.Date == tomorrow && a.Status == AppointmentStatus.Booked)
            .ToListAsync(ct);

        foreach (var appointment in appointments)
        {
            _logger.LogInformation("[STUB] Reminder would be sent for appointment {Id}", appointment.Id);

            string? precheckLink = null;
            var existingPrecheck = await db.PrecheckSubmissions
                .FirstOrDefaultAsync(s => s.AppointmentId == appointment.Id, ct);
            if (existingPrecheck is { SubmittedAt: null } && DateTimeOffset.UtcNow < existingPrecheck.ExpiresAt)
            {
                // The plaintext token was discarded after creation — we can't send a working link
                // without an out-of-band recovery channel. For now, the booking-time link is the
                // canonical one. Reminder includes a generic "fill the pre-visit form" prompt.
            }

            await notificationService.SendAppointmentReminderAsync(
                appointment.Id,
                appointment.Patient.Phone,
                appointment.Clinic.Name,
                appointment.Date.ToDateTime(TimeOnly.Parse(appointment.TimeSlot)),
                precheckLink);
        }
    }
}
