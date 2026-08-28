using Hospital_CRM.Domain.Entities;
using Hospital_CRM.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Hospital_CRM.Api.Services;

public static class AuditService
{
    public static async Task LogChangeAsync(
        HospitalCrmDbContext context,
        string entityType,
        Guid entityId,
        Guid userId,
        string fieldName,
        string oldValue,
        string newValue,
        CancellationToken ct = default)
    {
        if (entityType == "Patient")
        {
            context.PatientAuditLogs.Add(new PatientAuditLog
            {
                Id = Guid.NewGuid(),
                PatientId = entityId,
                ChangedBy = userId,
                FieldName = fieldName,
                OldValue = oldValue ?? string.Empty,
                NewValue = newValue ?? string.Empty,
                ChangedAt = DateTimeOffset.UtcNow
            });
            await context.SaveChangesAsync(ct);
        }
    }
}
