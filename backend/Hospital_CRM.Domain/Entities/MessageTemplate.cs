using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class MessageTemplate
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = null!;
    public NotificationChannel Channel { get; set; }
    public string Content { get; set; } = null!;
    public TemplateApprovalStatus ApprovalStatus { get; set; } = TemplateApprovalStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; }
}
