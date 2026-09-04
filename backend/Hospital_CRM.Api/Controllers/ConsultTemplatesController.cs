using System.Text.Json;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/consult-templates")]
public class ConsultTemplatesController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public ConsultTemplatesController(HospitalCrmDbContext db) => _db = db;

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> List([FromQuery] string specialty, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(specialty))
            return BadRequest(new { error = "specialty_required" });

        var userId = User.GetUserId();

        // Returns built-in templates (DoctorId == null) for the specialty
        // PLUS the calling doctor's own custom templates for that specialty
        var templates = await _db.ConsultTemplates
            .Where(t => t.Specialty == specialty &&
                        (t.DoctorId == null || t.DoctorId == userId))
            .OrderByDescending(t => t.IsBuiltIn)
            .ThenBy(t => t.Name)
            .Select(t => new
            {
                id = t.Id,
                specialty = t.Specialty,
                name = t.Name,
                isBuiltIn = t.IsBuiltIn,
                structure = JsonSerializer.Deserialize<JsonElement>(t.StructureJson)
            })
            .ToListAsync(ct);

        return Ok(templates);
    }

    [HttpPost]
    [AuthorizeRoles("Doctor")]
    public async Task<IActionResult> Create([FromBody] CreateConsultTemplateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Specialty) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "specialty_and_name_required" });

        if (request.Structure is null)
            return BadRequest(new { error = "structure_required" });

        var userId = User.GetUserId();
        if (!userId.HasValue)
            return Unauthorized(new { error = "invalid_token" });

        var doctor = await _db.Users.FindAsync([userId.Value], ct);
        if (doctor is null)
            return Unauthorized(new { error = "user_not_found" });

        var template = new ConsultTemplate
        {
            Id = Guid.NewGuid(),
            TenantId = doctor.TenantId,
            DoctorId = userId.Value,
            Specialty = request.Specialty,
            Name = request.Name,
            StructureJson = request.Structure.Value.GetRawText(),
            IsBuiltIn = false,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.ConsultTemplates.Add(template);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            id = template.Id,
            specialty = template.Specialty,
            name = template.Name,
            isBuiltIn = false
        });
    }
}

public record CreateConsultTemplateRequest(string Specialty, string Name, JsonElement? Structure);
