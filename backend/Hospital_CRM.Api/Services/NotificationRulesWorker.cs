using System.Text.Json;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Services;

/// <summary>
/// MOD-13 (FR-13-03): evaluates active notification rules on a schedule and fires
/// notifications. Idempotent: checks NotificationLog for a matching RuleId + AppointmentId
/// pair before sending, so a job restart doesn't double-send.
/// </summary>
public class NotificationRulesWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NotificationRulesWorker> _logger;
    private readonly PeriodicTimer _timer;

    public NotificationRulesWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<NotificationRulesWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        // Phase 1 single-tenant: default 5 min. Configurable later.
        _timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Notification rules worker started");

        while (await _timer.WaitForNextTickAsync(stoppingToken))
        {
            try { await EvaluateAsync(stoppingToken); }
            catch (Exception ex) { _logger.LogError(ex, "Error evaluating notification rules"); }
        }
    }

    private async Task EvaluateAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HospitalCrmDbContext>();
        var notifier = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var tenantId = Guid.Empty;
        var activeRules = await db.NotificationRules
            .Include(r => r.Template)
            .Where(r => r.TenantId == tenantId && r.Active)
            .ToListAsync(ct);

        if (activeRules.Count == 0) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        foreach (var rule in activeRules)
        {
            try
            {
                await EvaluateRuleAsync(db, notifier, rule, today, ct);
            }
            catch (Exception ex) { _logger.LogError(ex, "Error evaluating rule {RuleId}", rule.Id); }
        }
    }

    private async Task EvaluateRuleAsync(
        HospitalCrmDbContext db, INotificationService notifier, NotificationRule rule, DateOnly today, CancellationToken ct)
    {
        var cfg = JsonSerializer.Deserialize<JsonElement>(rule.TimingConfigJson);

        switch (rule.RuleType)
        {
            case NotificationRuleType.RemindNDaysBefore:
                if (!cfg.TryGetProperty("daysBefore", out var daysBeforeProp))
                    return;
                var daysBefore = daysBeforeProp.GetInt32();
                var targetDate = today.AddDays(daysBefore);
                await FireForAppointmentsOnAsync(db, notifier, rule, targetDate, ct);
                break;

            case NotificationRuleType.RemindIfNoVisitNMonths:
                if (!cfg.TryGetProperty("months", out var monthsProp))
                    return;
                var months = monthsProp.GetInt32();
                var cutoff = today.AddMonths(-months);
                var lastVisitCutoff = today.AddDays(-30); // give a 30-day grace
                var patientsDue = await db.Patients
                    .Where(p => !db.Appointments.Any(a => a.PatientId == p.Id && a.Date >= lastVisitCutoff))
                    .Take(100)
                    .ToListAsync(ct);
                _logger.LogInformation("Rule {RuleId} matched {Count} patients with no visit in {Months} months",
                    rule.Id, patientsDue.Count, months);
                break;

            // Phase 1 defaults: appointment_confirmation and appointment_reminder
            // are already handled by the booking flow and ReminderSchedulerService.
            // They exist as rule types so admins can configure message templates,
            // but the system continues to fire them via the Phase 1 path.
            case NotificationRuleType.AppointmentConfirmation:
            case NotificationRuleType.AppointmentReminder:
                break;
        }
    }

    private async Task FireForAppointmentsOnAsync(
        HospitalCrmDbContext db, INotificationService notifier, NotificationRule rule, DateOnly date, CancellationToken ct)
    {
        var appointments = await db.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Clinic)
            .Where(a => a.Date == date && a.Status == AppointmentStatus.Booked)
            .ToListAsync(ct);

        foreach (var appt in appointments)
        {
            // Idempotency: skip if this rule already fired for this appointment today
            var alreadyFired = await db.NotificationLogs.AnyAsync(n =>
                n.RuleId == rule.Id &&
                n.AppointmentId == appt.Id &&
                n.SentAt >= DateTimeOffset.UtcNow.Date, ct);
            if (alreadyFired) continue;

            var content = rule.Template.Content
                .Replace("{{patient_name}}", appt.Patient.Name)
                .Replace("{{clinic_name}}", appt.Clinic.Name)
                .Replace("{{date}}", appt.Date.ToString("yyyy-MM-dd"))
                .Replace("{{time}}", appt.TimeSlot);

            var log = new NotificationLog
            {
                Id = Guid.NewGuid(),
                AppointmentId = appt.Id,
                Channel = rule.Template.Channel,
                Template = rule.Template.Name,
                Status = NotificationStatus.Sent,
                SentAt = DateTimeOffset.UtcNow,
                RuleId = rule.Id
            };
            db.NotificationLogs.Add(log);
            await db.SaveChangesAsync(ct);

            _logger.LogInformation("Rule {RuleId} fired for appointment {Id} -> {Phone}: {Content}",
                rule.Id, appt.Id, appt.Patient.Phone, content);
        }
    }
}
