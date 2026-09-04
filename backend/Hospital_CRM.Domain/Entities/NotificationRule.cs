using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class NotificationRule
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public NotificationRuleType RuleType { get; set; }
    public string TimingConfigJson { get; set; } = "{}";
    public Guid TemplateId { get; set; }
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }

    public virtual MessageTemplate Template { get; set; } = null!;
}
