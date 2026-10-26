using Hospital_CRM.Domain.Constants;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Hospital_CRM.Api.Services;

/// <summary>
/// Universal module gate evaluating tenant plan entitlement and kill switch overrides per Decision D6.
/// Pure read with zero writes; results cached for a short TTL so a revoked module takes effect quickly.
/// </summary>
public class ModuleGateService : IModuleGateService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    private readonly HospitalCrmDbContext _db;
    private readonly IMemoryCache? _cache;

    // Cache is optional so unit tests can construct the gate without a container.
    public ModuleGateService(HospitalCrmDbContext db, IMemoryCache? cache = null)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<bool> IsModuleEnabledAsync(Guid tenantId, string moduleCode, CancellationToken ct = default) =>
        await EvaluateAsync(tenantId, moduleCode, ct) == ModuleGateStatus.Enabled;

    public async Task<ModuleGateStatus> EvaluateAsync(Guid tenantId, string moduleCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(moduleCode))
            return ModuleGateStatus.NotEntitled;

        var normalizedCode = moduleCode.Trim().ToLowerInvariant();

        // "core" is always enabled for any valid tenant.
        if (normalizedCode == ModuleRegistry.Core)
            return tenantId != Guid.Empty ? ModuleGateStatus.Enabled : ModuleGateStatus.NotEntitled;

        if (tenantId == Guid.Empty || !ModuleRegistry.IsKnown(normalizedCode))
            return ModuleGateStatus.NotEntitled;

        var cacheKey = $"module-gate:{tenantId:N}:{normalizedCode}";
        if (_cache is not null && _cache.TryGetValue(cacheKey, out ModuleGateStatus cached))
            return cached;

        var status = await EvaluateUncachedAsync(tenantId, normalizedCode, ct);
        _cache?.Set(cacheKey, status, CacheTtl);
        return status;
    }

    private async Task<ModuleGateStatus> EvaluateUncachedAsync(
        Guid tenantId, string moduleCode, CancellationToken ct)
    {
        var tenant = await _db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant is null)
            return ModuleGateStatus.NotEntitled;

        var entitledModules = ModuleRegistry.Parse(tenant.ActivatedModules);
        if (!ModuleRegistry.IsEntitled(entitledModules, moduleCode))
            return ModuleGateStatus.NotEntitled;

        var flag = await _db.TenantFeatureFlags.AsNoTracking()
            .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.FlagName.ToLower() == moduleCode, ct);

        if (flag is not null && !flag.Enabled)
            return ModuleGateStatus.Disabled;

        return ModuleGateStatus.Enabled;
    }
}
