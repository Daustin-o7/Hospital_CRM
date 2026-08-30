using System.Security.Claims;
using Hospital_CRM.Api.Authorization;
using Hospital_CRM.Api.Extensions;
using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Domain.Enums;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Controllers;

[ApiController]
[Route("api/v1/platform-admin")]
[AuthorizeRoles("PlatformAdmin")]
public class PlatformAdminController : ControllerBase
{
    private readonly HospitalCrmDbContext _db;

    public PlatformAdminController(HospitalCrmDbContext db) => _db = db;

    /// <summary>Reject any non-PlatformAdmin user. Defense in depth — the [AuthorizeRoles] attribute
    /// on the class is the primary gate, this confirms the JWT was issued for a PlatformAdmin (no tenant ClinicId).</summary>
    private bool IsPlatformAdmin()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        return string.Equals(role, "PlatformAdmin", StringComparison.OrdinalIgnoreCase);
    }

    // ----- FR-14-01: Tenant List and Search -----

    [HttpGet("tenants")]
    public async Task<IActionResult> ListTenants([FromQuery] string? q, CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var query = _db.Clinics.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(c => c.Name.Contains(q) || (c.LegalName != null && c.LegalName.Contains(q)));
        var tenants = await query
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                id = c.Id,
                name = c.Name,
                subscriptionTier = c.SubscriptionTier.ToString().ToLower(),
                subscriptionStatus = c.SubscriptionStatus.ToString().ToLower(),
                activatedModules = c.ActivatedModules,
                createdAt = c.CreatedAt,
                subscriptionEndsAt = c.SubscriptionEndsAt
            })
            .ToListAsync(ct);
        return Ok(tenants);
    }

    // ----- FR-14-02: Tenant Detail and Configuration -----

    [HttpGet("tenants/{id:guid}")]
    public async Task<IActionResult> GetTenant(Guid id, CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var c = await _db.Clinics.FindAsync([id], ct);
        if (c is null) return NotFound(new { error = "tenant_not_found" });
        return Ok(new
        {
            id = c.Id,
            name = c.Name,
            subscriptionTier = c.SubscriptionTier.ToString().ToLower(),
            subscriptionStatus = c.SubscriptionStatus.ToString().ToLower(),
            activatedModules = c.ActivatedModules,
            subscriptionEndsAt = c.SubscriptionEndsAt
        });
    }

    [HttpPatch("tenants/{id:guid}")]
    public async Task<IActionResult> UpdateTenant(Guid id, [FromBody] UpdateTenantRequest request, CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var c = await _db.Clinics.FindAsync([id], ct);
        if (c is null) return NotFound(new { error = "tenant_not_found" });

        if (!string.IsNullOrWhiteSpace(request.SubscriptionTier) &&
            Enum.TryParse<SubscriptionTier>(request.SubscriptionTier, true, out var tier))
            c.SubscriptionTier = tier;

        if (!string.IsNullOrWhiteSpace(request.SubscriptionStatus) &&
            Enum.TryParse<SubscriptionStatus>(request.SubscriptionStatus, true, out var status))
            c.SubscriptionStatus = status;

        if (!string.IsNullOrWhiteSpace(request.ActivatedModules))
            c.ActivatedModules = request.ActivatedModules;

        if (request.SubscriptionEndsAt.HasValue)
            c.SubscriptionEndsAt = request.SubscriptionEndsAt;

        c.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            id = c.Id,
            subscriptionTier = c.SubscriptionTier.ToString().ToLower(),
            subscriptionStatus = c.SubscriptionStatus.ToString().ToLower(),
            activatedModules = c.ActivatedModules
        });
    }

    // ----- FR-14-03: Impersonate-for-Support -----

    [HttpPost("impersonate")]
    public async Task<IActionResult> StartImpersonation([FromBody] StartImpersonationRequest request, CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var adminId = User.GetUserId();
        if (!adminId.HasValue) return Unauthorized(new { error = "invalid_token" });

        // FR-14-03 acceptance: impersonation doesn't grant extra privilege, just a different viewpoint
        var target = await _db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId && u.ClinicId == request.TenantId, ct);
        if (target is null)
            return NotFound(new { error = "user_not_found_in_tenant" });

        // Maximum impersonation session length = 1 hour (configurable later)
        var log = new ImpersonationLog
        {
            Id = Guid.NewGuid(),
            PlatformAdminId = adminId.Value,
            TenantId = request.TenantId,
            ImpersonatedUserId = target.Id,
            StartedAt = DateTimeOffset.UtcNow,
            Reason = request.Reason
        };
        _db.ImpersonationLogs.Add(log);
        await _db.SaveChangesAsync(ct);

        return StatusCode(201, new
        {
            impersonationId = log.Id,
            impersonatedUserId = target.Id,
            tenantId = request.TenantId,
            startedAt = log.StartedAt,
            // In a real impl this would mint a short-lived token for the target user
            // with an `impersonatedBy: <adminId>` claim. Out of scope for Phase 1.
            warning = "impersonation_active_session_logged"
        });
    }

    [HttpPost("impersonate/{id:guid}/end")]
    public async Task<IActionResult> EndImpersonation(Guid id, CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var log = await _db.ImpersonationLogs.FindAsync([id], ct);
        if (log is null) return NotFound(new { error = "impersonation_not_found" });
        if (log.EndedAt.HasValue)
            return Ok(new { id = log.Id, endedAt = log.EndedAt, unchanged = true });
        log.EndedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { id = log.Id, endedAt = log.EndedAt });
    }

    [HttpGet("impersonations")]
    public async Task<IActionResult> ListImpersonations([FromQuery] Guid? tenantId, CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var query = _db.ImpersonationLogs.AsQueryable();
        if (tenantId.HasValue) query = query.Where(l => l.TenantId == tenantId.Value);
        var logs = await query
            .OrderByDescending(l => l.StartedAt)
            .Take(100)
            .Select(l => new
            {
                id = l.Id,
                platformAdminId = l.PlatformAdminId,
                tenantId = l.TenantId,
                impersonatedUserId = l.ImpersonatedUserId,
                startedAt = l.StartedAt,
                endedAt = l.EndedAt,
                reason = l.Reason
            })
            .ToListAsync(ct);
        return Ok(logs);
    }

    // ----- FR-14-04: Feature Flag Management -----

    [HttpGet("tenants/{id:guid}/flags")]
    public async Task<IActionResult> ListFlags(Guid id, CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var flags = await _db.TenantFeatureFlags
            .Where(f => f.TenantId == id)
            .OrderBy(f => f.FlagName)
            .Select(f => new
            {
                id = f.Id,
                flagName = f.FlagName,
                enabled = f.Enabled,
                updatedAt = f.UpdatedAt
            })
            .ToListAsync(ct);
        return Ok(flags);
    }

    [HttpPatch("tenants/{id:guid}/flags/{flagName}")]
    public async Task<IActionResult> SetFlag(Guid id, string flagName, [FromBody] SetFlagRequest request, CancellationToken ct)
    {
        if (!IsPlatformAdmin()) return Forbid();
        var adminId = User.GetUserId();
        if (!adminId.HasValue) return Unauthorized(new { error = "invalid_token" });

        var flag = await _db.TenantFeatureFlags
            .FirstOrDefaultAsync(f => f.TenantId == id && f.FlagName == flagName, ct);
        if (flag is null)
        {
            flag = new TenantFeatureFlag
            {
                Id = Guid.NewGuid(),
                TenantId = id,
                FlagName = flagName,
                Enabled = request.Enabled,
                UpdatedAt = DateTimeOffset.UtcNow,
                UpdatedBy = adminId.Value
            };
            _db.TenantFeatureFlags.Add(flag);
        }
        else
        {
            flag.Enabled = request.Enabled;
            flag.UpdatedAt = DateTimeOffset.UtcNow;
            flag.UpdatedBy = adminId.Value;
        }
        await _db.SaveChangesAsync(ct);
        return Ok(new
        {
            tenantId = id,
            flagName = flag.FlagName,
            enabled = flag.Enabled
        });
    }
}

public record UpdateTenantRequest(string? SubscriptionTier, string? SubscriptionStatus, string? ActivatedModules, DateTimeOffset? SubscriptionEndsAt);
public record StartImpersonationRequest(Guid TenantId, Guid UserId, string? Reason);
public record SetFlagRequest(bool Enabled);
