using System.ComponentModel.DataAnnotations;

namespace Hospital_CRM.Domain.Entities;

public class PasswordResetToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    
    [MaxLength(512)]
    public string TokenHash { get; set; } = string.Empty;
    
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    
    // Navigation
    public virtual User User { get; set; } = null!;
}