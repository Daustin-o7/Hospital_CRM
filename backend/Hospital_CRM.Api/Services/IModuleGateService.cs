namespace Hospital_CRM.Api.Services;

public enum ModuleGateStatus
{
    /// <summary>Owned (including dependencies) and not overridden off.</summary>
    Enabled,
    /// <summary>Not in Tenant.ActivatedModules, or a dependency is missing.</summary>
    NotEntitled,
    /// <summary>Owned, but a TenantFeatureFlag kill switch is off.</summary>
    Disabled
}

/// <summary>
/// Universal module gate evaluating tenant entitlements and kill switch overrides (D6).
/// Decision D6: a module is usable only when it is entitled in Tenant.ActivatedModules AND
/// not overridden off in TenantFeatureFlags. Results are cached briefly because both values
/// change rarely and the gate runs on every module-scoped request.
/// </summary>
public interface IModuleGateService
{
    Task<bool> IsModuleEnabledAsync(Guid tenantId, string moduleCode, CancellationToken ct = default);
    Task<ModuleGateStatus> EvaluateAsync(Guid tenantId, string moduleCode, CancellationToken ct = default);
}
