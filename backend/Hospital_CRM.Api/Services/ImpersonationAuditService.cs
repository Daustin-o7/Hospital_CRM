using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Hospital_CRM.Api.Services;

public record PhiAccessRecord(
    Guid ImpersonationId,
    Guid PlatformAdminId,
    Guid ImpersonatedUserId,
    Guid? TenantId,
    string Path,
    string Method,
    int StatusCode,
    DateTimeOffset Timestamp
);

public interface IImpersonationAuditService
{
    Task RecordPhiAccessAsync(Guid impersonationId, Guid platformAdminId, Guid impersonatedUserId, Guid? tenantId, string path, string method, int statusCode, CancellationToken ct = default);
    Task<IReadOnlyList<PhiAccessRecord>> GetPhiAccessRecordsAsync(Guid impersonationId, CancellationToken ct = default);
    Task<IReadOnlyDictionary<Guid, int>> GetPhiAccessCountsAsync(IReadOnlyCollection<Guid> impersonationIds, CancellationToken ct = default);
}

/// <summary>
/// A5: PHI reads performed during impersonation are written to ImpersonationPhiAccessLogs
/// (append-only at the DB role) so the evidence survives an application restart. Only
/// impersonated reads take this write, never normal traffic.
/// </summary>
public class ImpersonationAuditService : IImpersonationAuditService
{
    private readonly HospitalCrmDbContext _db;
    private readonly ILogger<ImpersonationAuditService> _logger;

    public ImpersonationAuditService(HospitalCrmDbContext db, ILogger<ImpersonationAuditService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task RecordPhiAccessAsync(
        Guid impersonationId,
        Guid platformAdminId,
        Guid impersonatedUserId,
        Guid? tenantId,
        string path,
        string method,
        int statusCode,
        CancellationToken ct = default)
    {
        _db.ImpersonationPhiAccessLogs.Add(new ImpersonationPhiAccessLog
        {
            Id = Guid.NewGuid(),
            ImpersonationId = impersonationId,
            PlatformAdminId = platformAdminId,
            ImpersonatedUserId = impersonatedUserId,
            TenantId = tenantId,
            Path = path,
            Method = method,
            StatusCode = statusCode,
            Timestamp = DateTimeOffset.UtcNow
        });

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // Never fail a read because its audit row could not be written - but say so loudly.
            _logger.LogError(ex,
                "Failed to persist PHI access audit row for impersonation {ImpersonationId} ({Method} {Path})",
                impersonationId, method, path);
        }

        _logger.LogInformation(
            "PHI read during impersonation: admin={PlatformAdminId} user={ImpersonatedUserId} tenant={TenantId} {Method} {Path} -> {StatusCode}",
            platformAdminId, impersonatedUserId, tenantId, method, path, statusCode);
    }

    public async Task<IReadOnlyList<PhiAccessRecord>> GetPhiAccessRecordsAsync(Guid impersonationId, CancellationToken ct = default)
    {
        return await _db.ImpersonationPhiAccessLogs
            .AsNoTracking()
            .Where(a => a.ImpersonationId == impersonationId)
            .OrderBy(a => a.Timestamp)
            .Take(1000)
            .Select(a => new PhiAccessRecord(
                a.ImpersonationId, a.PlatformAdminId, a.ImpersonatedUserId, a.TenantId,
                a.Path, a.Method, a.StatusCode, a.Timestamp))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyDictionary<Guid, int>> GetPhiAccessCountsAsync(IReadOnlyCollection<Guid> impersonationIds, CancellationToken ct = default)
    {
        if (impersonationIds.Count == 0)
            return new Dictionary<Guid, int>();

        var rows = await _db.ImpersonationPhiAccessLogs
            .AsNoTracking()
            .Where(a => impersonationIds.Contains(a.ImpersonationId))
            .GroupBy(a => a.ImpersonationId)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return rows.ToDictionary(r => r.Id, r => r.Count);
    }
}
