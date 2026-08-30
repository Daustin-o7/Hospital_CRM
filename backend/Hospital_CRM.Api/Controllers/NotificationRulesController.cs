using System.Text.Json;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/notification-rules")]
public class NotificationRulesController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public NotificationRulesController(HospitalCrmDbContext db) => _db = db;

    [HttpGet]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var rules = await _db.NotificationRules
            .Include(r => r.Template)
            .Where(r => r.TenantId == tenantId)
            .OrderBy(r => r.RuleType)
            .Select(r => new
            {
                id = r.Id,
                ruleType = r.RuleType.ToString().ToLower(),
                timingConfig = JsonSerializer.Deserialize<JsonElement>(r.TimingConfigJson),
                templateId = r.TemplateId,
                templateName = r.Template.Name,
                active = r.Active,
                createdAt = r.CreatedAt
            })
            .ToListAsync(ct);
        return Ok(rules);
    }

    [HttpPost]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Create([FromBody] CreateNotificationRuleRequest request, CancellationToken ct)
    {
        if (!Enum.TryParse<NotificationRuleType>(request.RuleType, true, out var ruleType))
            return BadRequest(new { error = "invalid_rule_type" });

        if (request.TimingConfig is null)
            return BadRequest(new { error = "timing_config_required" });

        var tenantId = Guid.Empty;
        var template = await _db.MessageTemplates.FindAsync([request.TemplateId], ct);
        if (template is null || template.TenantId != tenantId)
            return BadRequest(new { error = "template_not_found" });

        var rule = new NotificationRule
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RuleType = ruleType,
            TimingConfigJson = request.TimingConfig.Value.GetRawText(),
            TemplateId = request.TemplateId,
            Active = request.Active ?? true,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.NotificationRules.Add(rule);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = rule.Id,
            ruleType = rule.RuleType.ToString().ToLower(),
            templateId = rule.TemplateId,
            active = rule.Active
        });
    }

    [HttpPatch("{id:guid}")]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateNotificationRuleRequest request, CancellationToken ct)
    {
        var tenantId = Guid.Empty;
        var rule = await _db.NotificationRules.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId, ct);
        if (rule is null)
            return NotFound(new { error = "rule_not_found" });

        if (request.Active.HasValue) rule.Active = request.Active.Value;
        await _db.SaveChangesAsync(ct);

        return Ok(new { id = rule.Id, active = rule.Active });
    }
}

public record CreateNotificationRuleRequest(string RuleType, JsonElement? TimingConfig, Guid TemplateId, bool? Active);
public record UpdateNotificationRuleRequest(bool? Active);
