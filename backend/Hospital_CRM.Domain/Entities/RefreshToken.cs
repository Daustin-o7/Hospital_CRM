using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    
    [MaxLength(512)]
    public string TokenHash { get; set; } = string.Empty;
    
    public DateTimeOffset IssuedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset? LastUsedAt { get; set; }
    public Guid? FamilyId { get; set; }

    // Scope the session was issued for. A refresh must re-issue exactly this scope,
    // never fall back to User.TenantId (that would move a multi-clinic doctor).
    public Guid? TenantId { get; set; }
    public Guid? ClinicId { get; set; }
    public UserRole Role { get; set; }
    
    // Navigation
    public virtual User User { get; set; } = null!;
}