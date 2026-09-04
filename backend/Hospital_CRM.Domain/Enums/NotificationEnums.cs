namespace Hospital_CRM.Domain.Enums;

public enum NotificationRuleType
{
    RemindNDaysBefore = 0,
    RemindIfNoVisitNMonths = 1,
    AppointmentConfirmation = 2,  // Phase 1 FR-20 default
    AppointmentReminder = 3       // Phase 1 FR-21 default
}

public enum MessageChannel
{
    WhatsApp = 0,
    Sms = 1,
    Email = 2
}

public enum TemplateApprovalStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}
