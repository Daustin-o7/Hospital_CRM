using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/message-templates")]
public class MessageTemplatesController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public MessageTemplatesController(HospitalCrmDbContext db) => _db = db;

    [HttpGet]
    [AuthorizeRoles("ClinicAdmin", "Receptionist", "Doctor")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        // Phase 1: single-tenant. All data uses TenantId = Guid.Empty (dormant).
        var tenantId = Guid.Empty;
        var templates = await _db.MessageTemplates
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.Name)
            .Select(t => new
            {
                id = t.Id,
                name = t.Name,
                channel = t.Channel.ToString().ToLower(),
                content = t.Content,
                approvalStatus = t.ApprovalStatus.ToString().ToLower(),
                createdAt = t.CreatedAt
            })
            .ToListAsync(ct);
        return Ok(templates);
    }

    [HttpPost]
    [AuthorizeRoles("ClinicAdmin")]
    public async Task<IActionResult> Create([FromBody] CreateMessageTemplateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Content))
            return BadRequest(new { error = "name_and_content_required" });

        if (!Enum.TryParse<NotificationChannel>(request.Channel, true, out var channel))
            return BadRequest(new { error = "invalid_channel" });

        var tenantId = Guid.Empty;
        var template = new MessageTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name,
            Channel = channel,
            Content = request.Content,
            // Meta/BSP approval is an external process; default to pending until
            // the channel confirms approval.
            ApprovalStatus = TemplateApprovalStatus.Pending,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.MessageTemplates.Add(template);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = template.Id,
            name = template.Name,
            channel = template.Channel.ToString().ToLower(),
            approvalStatus = template.ApprovalStatus.ToString().ToLower()
        });
    }
}

public record CreateMessageTemplateRequest(string Name, string Channel, string Content);
