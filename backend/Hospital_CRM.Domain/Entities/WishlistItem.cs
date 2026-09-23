using Hospital_CRM.Domain.Enums;

namespace Hospital_CRM.Domain.Entities;

public class WishlistItem
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid CreatedBy { get; set; }
    public string Text { get; set; } = null!;
    public WishlistCategory Category { get; set; }
    public WishlistStatus Status { get; set; } = WishlistStatus.Open;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    public virtual User Creator { get; set; } = null!;
}
