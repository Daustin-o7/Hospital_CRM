namespace Hospital_CRM.Api.Services;

/// <summary>
/// Universal module gate service evaluating tenant entitlements and kill switch overrides (D6).
/// Decision D6: A module is usable only when it is entitled in Tenant.ActivatedModules AND not overridden off in TenantFeatureFlags.
/// </summary>
public interface IModuleGateService
{
    /// <summary>
    /// Checks whether a given module is enabled for the specified tenant.
    /// Pure read, zero database writes.
    /// </summary>
    Task<bool> IsModuleEnabledAsync(Guid tenantId, string moduleCode, CancellationToken ct = default);
}
