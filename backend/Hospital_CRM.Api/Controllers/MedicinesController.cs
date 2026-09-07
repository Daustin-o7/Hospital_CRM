using Hospital_CRM.Api.Services.Typesense;
using Microsoft.AspNetCore.Mvc;

namespace Hospital_CRM.Api.Controllers;

[Route("api/v1/[controller]")]
[ApiController]
public class MedicinesController : ControllerBase
{
    private readonly IPatientSearchService _search;

    public MedicinesController(IPatientSearchService search)
    {
        _search = search;
    }

    /// <summary>
    /// Search the Typesense medicines collection.
    /// Query parameter: q (free-text search term)
    /// Results include medicine name, generic name, strength, form, manufacturer, HSN code.
    /// Typesense fallback to PostgreSQL is handled internally by the service.
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult> Search([FromQuery] string q = null!, CancellationToken ct = default)
    {
        var tenantId = Guid.Empty; // single-tenant Phase 1; will be sourced from JWT claims in multi-tenant phase
        var results = await _search.MedicinesSearchAsync(q, tenantId, ct: ct);
        return Ok(results);
    }
}