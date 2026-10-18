using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Api.Services.Typesense;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class MedicinesController : ControllerBase
{
    private readonly IPatientSearchService _search;
    private readonly ILogger<MedicinesController> _logger;

    public MedicinesController(IPatientSearchService search, ILogger<MedicinesController> logger)
    {
        _search = search;
        _logger = logger;
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] int limit = 10, CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        if (!userId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var tenantId = Guid.Empty;

        if (string.IsNullOrWhiteSpace(q))
            return Ok(Array.Empty<object>());

        var hits = await _search.MedicinesSearchAsync(q.Trim(), tenantId, Math.Clamp(limit, 1, 50), ct);

        var results = hits.Select(h => new
        {
            id = h.Id,
            name = h.Name,
            genericName = h.GenericName,
            commonBrands = h.CommonBrands,
            strength = h.Strength,
            dosageForm = h.DosageForm,
            score = h.Score
        });

        return Ok(results);
    }
}