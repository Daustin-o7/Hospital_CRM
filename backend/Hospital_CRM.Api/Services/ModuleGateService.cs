using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Services;

/// <summary>
/// Universal module gate evaluating tenant plan entitlement and kill switch overrides per Decision D6.
/// Guarantees pure read with zero database writes.
/// </summary>
public class ModuleGateService : IModuleGateService
{
    private readonly HospitalCrmDbContext _db;

    public ModuleGateService(HospitalCrmDbContext db)
    {
        _db = db;
    }

    public async Task<bool> IsModuleEnabledAsync(Guid tenantId, string moduleCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(moduleCode))
            return false;

        var normalizedCode = moduleCode.Trim().ToLowerInvariant();

        // 1. "core" module is always enabled for any valid tenant
        if (normalizedCode == ModuleRegistry.Core)
            return tenantId != Guid.Empty;

        // 2. Tenant must be specified
        if (tenantId == Guid.Empty)
            return false;

        // 3. Module must be recognized by ModuleRegistry
        if (!ModuleRegistry.IsKnown(normalizedCode))
            return false;

        // 4. Entitlement check: read Tenant row without tracking (zero writes)
        var tenant = await _db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant == null)
            return false;

        var entitledModules = ModuleRegistry.Parse(tenant.ActivatedModules);
        if (!entitledModules.Contains(normalizedCode, StringComparer.Ordinal))
            return false;

        // 5. Override check: check TenantFeatureFlags for this tenant + module
        var flag = await _db.TenantFeatureFlags.AsNoTracking()
            .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.FlagName.ToLower() == normalizedCode, ct);

        if (flag != null && !flag.Enabled)
            return false;

        return true;
    }
}
