namespace Hospital_CRM.Api.Services;

public interface INotificationService
{
    Task SendAppointmentConfirmationAsync(Guid appointmentId, string patientPhone, string clinicName, DateTime dateTime, string? precheckLink = null);
    Task SendAppointmentReminderAsync(Guid appointmentId, string patientPhone, string clinicName, DateTime dateTime, string? precheckLink = null);
}
