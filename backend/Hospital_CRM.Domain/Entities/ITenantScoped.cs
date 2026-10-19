namespace Hospital_CRM.Domain.Entities;

/// <summary>
/// Marks an entity as belonging to a specific tenant.
/// Used by EF Core global query filters and DbContext save interceptors
/// to guarantee tenant isolation and prevent cross-tenant data leakage.
/// </summary>
public interface ITenantScoped
{
    Guid TenantId { get; set; }
}
